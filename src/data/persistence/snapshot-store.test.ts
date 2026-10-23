import { describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import type { StoreSnapshot } from "./snapshot-policy";
import { createSnapshotRepository, type SnapshotBackend } from "./snapshot-store";

function memoryBackend(initial: unknown[] = []) {
  const items = new Map<string, unknown>(
    initial.map((item, index) => [String((item as { id?: string })?.id ?? index), item]),
  );
  const backend: SnapshotBackend = {
    getAll: async () => Array.from(items.values()),
    put: async (snapshot: StoreSnapshot) => {
      items.set(snapshot.id, structuredClone(snapshot));
    },
    remove: async (ids) => {
      ids.forEach((id) => items.delete(id));
    },
  };
  return { backend, items };
}

function storeWithIncome(amount: number): ExpenseStore {
  return {
    ...emptyStore,
    finance: {
      ...emptyStore.finance,
      incomeEvents: [
        {
          id: "evt",
          userId: "demo",
          name: "Extra",
          amount,
          currency: "EUR",
          receivedAt: "2026-10-10",
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
        },
      ],
    },
  };
}

describe("snapshot repository", () => {
  it("saves a copy with its summary and announces the change", async () => {
    const { backend } = memoryBackend();
    const onChange = vi.fn();
    const repository = createSnapshotRepository(backend, { onChange });

    const saved = await repository.save(storeWithIncome(40), "before-import", new Date("2026-10-23T09:00:00Z"));

    expect(saved).toMatchObject({
      reason: "before-import",
      createdAt: "2026-10-23T09:00:00.000Z",
      summary: { expenses: 0, payments: 0, incomeEvents: 1 },
    });
    expect(await repository.list()).toHaveLength(1);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("never stores an empty store", async () => {
    const { backend, items } = memoryBackend();
    const repository = createSnapshotRepository(backend);

    expect(await repository.save(emptyStore, "manual")).toBeNull();
    expect(await repository.saveDaily(emptyStore)).toBeNull();
    expect(items.size).toBe(0);
  });

  it("takes the daily copy once a day and skips unchanged data", async () => {
    const { backend } = memoryBackend();
    const repository = createSnapshotRepository(backend);
    const monday = new Date("2026-10-19T09:00:00");

    expect(await repository.saveDaily(storeWithIncome(40), monday)).not.toBeNull();
    expect(await repository.saveDaily(storeWithIncome(50), new Date("2026-10-19T20:00:00"))).toBeNull();
    expect(await repository.saveDaily(storeWithIncome(40), new Date("2026-10-20T09:00:00"))).toBeNull();
    expect(await repository.saveDaily(storeWithIncome(60), new Date("2026-10-20T09:00:00"))).not.toBeNull();
    expect((await repository.list()).map((snapshot) => snapshot.reason)).toEqual(["daily", "daily"]);
  });

  it("does not save two daily copies when two triggers overlap", async () => {
    const { backend } = memoryBackend();
    const repository = createSnapshotRepository(backend);
    const now = new Date("2026-10-23T09:00:00");

    await Promise.all([
      repository.saveDaily(storeWithIncome(40), now),
      repository.saveDaily(storeWithIncome(40), now),
    ]);

    expect(await repository.list()).toHaveLength(1);
  });

  it("prunes old copies and ignores damaged entries", async () => {
    const { backend, items } = memoryBackend([{ id: "broken", createdAt: "x" }]);
    const repository = createSnapshotRepository(backend);

    for (let day = 1; day <= 9; day += 1) {
      await repository.save(
        storeWithIncome(day),
        "daily",
        new Date(`2026-10-${String(day).padStart(2, "0")}T09:00:00Z`),
      );
    }

    const list = await repository.list();
    expect(list).toHaveLength(7);
    expect(list[0].createdAt).toBe("2026-10-09T09:00:00.000Z");
    expect(list.at(-1)?.createdAt).toBe("2026-10-03T09:00:00.000Z");
    // La entrada dañada no se lista, pero tampoco se borra a ciegas.
    expect(items.has("broken")).toBe(true);
  });
});
