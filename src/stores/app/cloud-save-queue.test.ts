import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { createCloudSaveQueue, type CloudSaveQueueDeps } from "./cloud-save-queue";

function storeNamed(name: string): ExpenseStore {
  return { ...emptyStore, categories: [{ ...emptyStore.categories[0], name }] };
}

function setup(
  save: (store: ExpenseStore) => Promise<{ mode: "table" | "unavailable" }>,
  overrides: Partial<CloudSaveQueueDeps> = {},
) {
  const deps = {
    resolveTarget: vi.fn(() => ({ userId: "user", save })),
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
    const save = vi.fn().mockResolvedValue({ mode: "table" });
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    queue.enqueue(storeNamed("b"), 2);
    await vi.advanceTimersByTimeAsync(350);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].categories[0].name).toBe("b");
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
            finishFirst = () => resolve({ mode: "table" });
          }),
      )
      .mockResolvedValue({ mode: "table" });
    const { deps, queue } = setup(save);

    queue.enqueue(storeNamed("a"), 1);
    await vi.advanceTimersByTimeAsync(350);
    queue.enqueue(storeNamed("b"), 2);
    await vi.advanceTimersByTimeAsync(350);
    expect(save).toHaveBeenCalledTimes(1);

    finishFirst();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].categories[0].name).toBe("b");
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
            finishFirst = () => resolve({ mode: "table" });
          }),
      )
      .mockResolvedValue({ mode: "table" });
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
    expect(save.mock.calls[1][0].categories[0].name).toBe("cleared");
    expect(deps.onSaving).toHaveBeenLastCalledWith("Vaciando");
  });

  it("resolves a pending save-now as not saved when the upload fails", async () => {
    const save = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { queue } = setup(save);

    await expect(queue.saveNow(storeNamed("a"), 1)).resolves.toBe(false);
  });

  it("drops saves when there is no cloud session to save to", async () => {
    const save = vi.fn().mockResolvedValue({ mode: "table" });
    let target: ReturnType<CloudSaveQueueDeps["resolveTarget"]> = null;
    const { queue } = setup(save, { resolveTarget: () => target });

    queue.enqueue(storeNamed("a"), 1);
    expect(queue.hasPending()).toBe(false);
    await expect(queue.saveNow(storeNamed("a"), 1)).resolves.toBe(false);

    target = { userId: "user", save };
    queue.enqueue(storeNamed("b"), 2);
    target = null;
    await vi.runAllTimersAsync();

    expect(save).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });
});
