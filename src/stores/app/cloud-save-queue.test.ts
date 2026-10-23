import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import type { CloudStoreSaveResult } from "@/data/persistence/cloud-store";
import {
  CloudSaveConflictError,
  MAX_CONFLICT_RETRIES,
  createCloudSaveQueue,
  saveResolvingConflicts,
  type CloudSaveQueueDeps,
} from "./cloud-save-queue";

function storeNamed(name: string): ExpenseStore {
  return {
    ...emptyStore,
    categories: [{ id: "cat", userId: "user", name, icon: "Home", tone: "green" }],
  };
}

function nameOf(store: ExpenseStore) {
  return store.categories[0]?.name;
}

const SAVED: CloudStoreSaveResult = { status: "saved", mode: "table", revision: 1 };
const CONFLICT: CloudStoreSaveResult = { status: "conflict", revision: 2 };

function setup(
  save: (store: ExpenseStore) => Promise<CloudStoreSaveResult>,
  overrides: Partial<CloudSaveQueueDeps> = {},
  resolveConflict: (store: ExpenseStore) => Promise<ExpenseStore> = vi.fn(),
) {
  const deps = {
    resolveTarget: vi.fn(() => ({ userId: "user", save, resolveConflict })),
    onSaving: vi.fn(),
    onSaved: vi.fn(),
    onFailed: vi.fn(),
    debounceMs: 350,
    ...overrides,
  };
  return { deps, queue: createCloudSaveQueue(deps) };
}

describe("createCloudSaveQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces edits and saves only the latest store", async () => {
    const save = vi.fn().mockResolvedValue(SAVED);
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    queue.enqueue(storeNamed("b"), 2);
    await vi.advanceTimersByTimeAsync(350);

    expect(save).toHaveBeenCalledTimes(1);
    expect(nameOf(save.mock.calls[0][0])).toBe("b");
    expect(deps.onSaved).toHaveBeenCalledWith({
      mode: "table",
      revision: 2,
      userId: "user",
      hasNewerChanges: false,
    });
    expect(queue.hasPending()).toBe(false);
  });

  it("never replays the same copy after a failure", async () => {
    const save = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    await vi.advanceTimersByTimeAsync(350);
    await vi.advanceTimersByTimeAsync(120_000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(deps.onFailed).toHaveBeenCalledWith(expect.any(TypeError));
    expect(queue.hasPending()).toBe(false);
  });

  it("never runs two saves at once and uploads edits made during a save", async () => {
    let finishFirst!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve(SAVED);
          }),
      )
      .mockResolvedValue(SAVED);
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    await vi.advanceTimersByTimeAsync(350);
    queue.enqueue(storeNamed("b"), 2);
    await vi.advanceTimersByTimeAsync(350);
    expect(save).toHaveBeenCalledTimes(1);

    finishFirst();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(nameOf(save.mock.calls[1][0])).toBe("b");
    expect(deps.onSaved).toHaveBeenNthCalledWith(1, expect.objectContaining({
      revision: 1,
      hasNewerChanges: true,
    }));
    expect(deps.onSaved).toHaveBeenNthCalledWith(2, expect.objectContaining({
      revision: 2,
      hasNewerChanges: false,
    }));
  });

  it("waits for its own revision when saving now behind a running save", async () => {
    let finishFirst!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve(SAVED);
          }),
      )
      .mockResolvedValue(SAVED);
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    await vi.advanceTimersByTimeAsync(350);
    let settled: boolean | null = null;
    void queue.saveNow(storeNamed("cleared"), 2, "Vaciando").then((saved) => {
      settled = saved;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBeNull();

    finishFirst();
    await vi.runAllTimersAsync();

    expect(settled).toBe(true);
    expect(nameOf(save.mock.calls[1][0])).toBe("cleared");
    expect(deps.onSaving).toHaveBeenLastCalledWith("Vaciando");
  });

  it("resolves a pending save-now as not saved when the upload fails", async () => {
    const save = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { queue } = setup(save);

    await expect(queue.saveNow(storeNamed("a"), 1)).resolves.toBe(false);
  });

  it("drops saves when there is no cloud session to save to", async () => {
    const save = vi.fn().mockResolvedValue(SAVED);
    let target: ReturnType<CloudSaveQueueDeps["resolveTarget"]> = null;
    const { queue } = setup(save, { resolveTarget: () => target });

    queue.enqueue(storeNamed("a"), 1);
    expect(queue.hasPending()).toBe(false);
    await expect(queue.saveNow(storeNamed("a"), 1)).resolves.toBe(false);

    target = { userId: "user", save, resolveConflict: vi.fn() };
    queue.enqueue(storeNamed("b"), 2);
    target = null;
    await vi.runAllTimersAsync();

    expect(save).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });

  it("merges with the cloud and retries when another device saved first", async () => {
    const save = vi.fn().mockResolvedValueOnce(CONFLICT).mockResolvedValue(SAVED);
    const resolveConflict = vi.fn().mockResolvedValue(storeNamed("merged"));
    const { deps, queue } = setup(save, {}, resolveConflict);

    queue.enqueue(storeNamed("phone"), 1);
    await vi.advanceTimersByTimeAsync(350);

    expect(resolveConflict).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [expect.objectContaining({ name: "phone" })] }),
    );
    expect(save.mock.calls.map(([store]) => nameOf(store))).toEqual(["phone", "merged"]);
    expect(deps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 1, hasNewerChanges: false }),
    );
    expect(deps.onFailed).not.toHaveBeenCalled();
  });

  it("replaces edits queued during the conflict with the merge that already has them", async () => {
    let finishFirst!: (result: CloudStoreSaveResult) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CloudStoreSaveResult>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValue(SAVED);
    const resolveConflict = vi.fn().mockResolvedValue(storeNamed("merged with edit"));
    const { deps, queue } = setup(save, {}, resolveConflict);

    queue.enqueue(storeNamed("first"), 1);
    await vi.advanceTimersByTimeAsync(350);
    // Se edita mientras sube la primera versión.
    queue.enqueue(storeNamed("edit"), 2);
    finishFirst(CONFLICT);
    await vi.runAllTimersAsync();

    // La copia "edit" no llevaba lo que trajo la nube: sube la fusión.
    expect(save.mock.calls.map(([store]) => nameOf(store))).toEqual([
      "first",
      "merged with edit",
      "merged with edit",
    ]);
    expect(deps.onSaved).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 2, hasNewerChanges: false }),
    );
  });

  it("does not save the same merge twice when nothing was edited meanwhile", async () => {
    const save = vi.fn().mockResolvedValueOnce(CONFLICT).mockResolvedValue(SAVED);
    const resolveConflict = vi.fn().mockResolvedValue(storeNamed("merged"));
    const { queue } = setup(save, {}, resolveConflict);

    queue.enqueue(storeNamed("a"), 1);
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.isIdle()).toBe(true);
  });

  it("gives up after repeated conflicts and lets the resync merge later", async () => {
    const save = vi.fn().mockResolvedValue(CONFLICT);
    const resolveConflict = vi.fn(async (store: ExpenseStore) => store);
    const { deps, queue } = setup(save, {}, resolveConflict);

    queue.enqueue(storeNamed("a"), 1);
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(MAX_CONFLICT_RETRIES + 1);
    expect(deps.onFailed).toHaveBeenCalledWith(expect.any(CloudSaveConflictError));
    expect(queue.hasPending()).toBe(false);
  });

  it("fails without retrying when resolving the conflict fails", async () => {
    const save = vi.fn().mockResolvedValue(CONFLICT);
    const resolveConflict = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { deps, queue } = setup(save, {}, resolveConflict);

    await expect(queue.saveNow(storeNamed("a"), 1)).resolves.toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(deps.onFailed).toHaveBeenCalledWith(expect.any(TypeError));
  });

  it("rebases only the copy that waits, never the one being saved", async () => {
    let finishFirst!: (result: CloudStoreSaveResult) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CloudStoreSaveResult>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValue(SAVED);
    const { queue } = setup(save);

    queue.enqueue(storeNamed("saving"), 1);
    await vi.advanceTimersByTimeAsync(350);
    queue.rebase(storeNamed("other tab"));
    expect(queue.isIdle()).toBe(false);
    finishFirst(SAVED);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);

    queue.enqueue(storeNamed("edit"), 2);
    queue.rebase(storeNamed("edit + other tab"));
    await vi.runAllTimersAsync();
    expect(nameOf(save.mock.lastCall![0])).toBe("edit + other tab");
  });
});

describe("saveResolvingConflicts", () => {
  it("returns the store that finally reached the cloud", async () => {
    const save = vi
      .fn<(store: ExpenseStore) => Promise<CloudStoreSaveResult>>()
      .mockResolvedValueOnce(CONFLICT)
      .mockResolvedValueOnce(CONFLICT)
      .mockResolvedValue({ status: "saved", mode: "table", revision: 7 });
    const resolveConflict = vi
      .fn<(store: ExpenseStore) => Promise<ExpenseStore>>()
      .mockResolvedValueOnce(storeNamed("merge 1"))
      .mockResolvedValueOnce(storeNamed("merge 2"));
    const onResolved = vi.fn();

    const result = await saveResolvingConflicts(storeNamed("local"), {
      save,
      resolveConflict,
      onResolved,
    });

    expect(result.mode).toBe("table");
    expect(nameOf(result.store)).toBe("merge 2");
    expect(onResolved.mock.calls.map(([store]) => nameOf(store))).toEqual([
      "merge 1",
      "merge 2",
    ]);
  });

  it("keeps local mode when the table is missing", async () => {
    const result = await saveResolvingConflicts(storeNamed("local"), {
      save: async () => ({ status: "saved", mode: "unavailable", revision: null }),
      resolveConflict: async (store) => store,
    });

    expect(result.mode).toBe("unavailable");
  });
});
