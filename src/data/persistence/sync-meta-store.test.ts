import { describe, expect, it } from "vitest";
import {
  hasUnsyncedChangesFor,
  readSyncMeta,
  SYNC_META_KEY,
  writeSyncMeta,
} from "./sync-meta-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("sync meta store", () => {
  it("round-trips the owner and dirty flag", () => {
    const storage = memoryStorage();
    writeSyncMeta(
      { ownerId: "user-1", dirty: true },
      { now: new Date("2026-10-23T10:00:00.000Z"), storage },
    );

    expect(readSyncMeta(storage)).toEqual({
      ownerId: "user-1",
      dirty: true,
      updatedAt: "2026-10-23T10:00:00.000Z",
    });
  });

  it("treats missing or unreadable metadata as clean", () => {
    expect(readSyncMeta(memoryStorage())).toMatchObject({ dirty: false });
    expect(
      readSyncMeta(memoryStorage({ [SYNC_META_KEY]: "{not json" })),
    ).toMatchObject({ ownerId: null, dirty: false });
  });

  it("only reports unsynced changes for the account that made them", () => {
    const meta = { ownerId: "user-1", dirty: true, updatedAt: "" };

    expect(hasUnsyncedChangesFor(meta, "user-1")).toBe(true);
    expect(hasUnsyncedChangesFor(meta, "user-2")).toBe(false);
    expect(hasUnsyncedChangesFor({ ...meta, dirty: false }, "user-1")).toBe(false);
  });
});
