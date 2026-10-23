import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import {
  hashStoreContent,
  isStoreSnapshot,
  shouldTakeDailySnapshot,
  snapshotsToPrune,
  type SnapshotReason,
  type StoreSnapshot,
} from "./snapshot-policy";

const store: ExpenseStore = {
  ...emptyStore,
  finance: { ...emptyStore.finance, incomeEvents: [] },
};

function snapshot(id: string, createdAt: string, reason: SnapshotReason, hash = id): StoreSnapshot {
  return {
    id,
    createdAt,
    reason,
    hash,
    summary: { expenses: 0, payments: 0, incomeEvents: 0 },
    store,
  };
}

describe("snapshot policy", () => {
  it("hashes the data but not the device preferences", () => {
    const other: ExpenseStore = { ...store, preferences: { theme: "nord", language: "en" } };
    const changed: ExpenseStore = { ...store, categories: [{ id: "c", userId: "u", name: "Casa", icon: "Home", tone: "green" }] };

    expect(hashStoreContent(store)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashStoreContent(other)).toBe(hashStoreContent(store));
    expect(hashStoreContent(changed)).not.toBe(hashStoreContent(store));
  });

  it("takes one daily copy per calendar day and only when the data changed", () => {
    const now = new Date("2026-10-23T09:00:00");
    const yesterday = snapshot("a", new Date("2026-10-22T20:00:00").toISOString(), "daily", "old");

    expect(shouldTakeDailySnapshot([], { now, hash: "new" })).toBe(true);
    expect(shouldTakeDailySnapshot([yesterday], { now, hash: "new" })).toBe(true);
    expect(shouldTakeDailySnapshot([yesterday], { now, hash: "old" })).toBe(false);
    expect(
      shouldTakeDailySnapshot(
        [snapshot("b", new Date("2026-10-23T08:00:00").toISOString(), "daily", "x")],
        { now, hash: "new" },
      ),
    ).toBe(false);
    // Una copia de seguridad de hoy no cuenta como la diaria.
    expect(
      shouldTakeDailySnapshot(
        [snapshot("c", new Date("2026-10-23T08:00:00").toISOString(), "before-import", "x")],
        { now, hash: "new" },
      ),
    ).toBe(true);
  });

  it("keeps the latest 7 daily copies and the latest 5 of the other kinds", () => {
    const daily = Array.from({ length: 9 }, (_, index) =>
      snapshot(`d${index}`, `2026-10-${String(10 + index).padStart(2, "0")}T09:00:00.000Z`, "daily"),
    );
    const other = Array.from({ length: 6 }, (_, index) =>
      snapshot(`o${index}`, `2026-10-${String(10 + index).padStart(2, "0")}T10:00:00.000Z`, index % 2 ? "manual" : "before-import"),
    );

    expect(snapshotsToPrune([...daily, ...other]).sort()).toEqual(["d0", "d1", "o0"]);
  });

  it("only accepts stored entries with the shape of a copy", () => {
    expect(isStoreSnapshot(snapshot("a", "2026-10-23T09:00:00.000Z", "daily"))).toBe(true);
    expect(isStoreSnapshot({ id: "a", createdAt: "nope", reason: "daily" })).toBe(false);
    expect(
      isStoreSnapshot({ ...snapshot("a", "2026-10-23T09:00:00.000Z", "daily"), reason: "weekly" }),
    ).toBe(false);
    expect(isStoreSnapshot(null)).toBe(false);
  });
});
