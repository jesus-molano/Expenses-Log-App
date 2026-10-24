import { describe, expect, it } from "vitest";
import {
  localChangesFor,
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

  it("tells unsynced changes of this account from another account's data", () => {
    const meta = { ownerId: "user-1", dirty: true, updatedAt: "" };

    expect(localChangesFor(meta, "user-1")).toEqual({ dirty: true, foreign: false });
    expect(localChangesFor(meta, "user-2")).toEqual({ dirty: false, foreign: true });
    expect(localChangesFor({ ...meta, dirty: false }, "user-1")).toEqual({
      dirty: false,
      foreign: false,
    });
    // Sin cuenta: son de la primera que entra.
    expect(localChangesFor({ ...meta, ownerId: null }, "user-2")).toEqual({
      dirty: true,
      foreign: false,
    });
  });

  it("falls back to the owner written in the data when there is no metadata", () => {
    const legacy = { ownerId: null, dirty: false, updatedAt: "" };

    // Un dispositivo que sincronizó como user-1 antes de los metadatos.
    expect(localChangesFor(legacy, "user-2", "user-1")).toEqual({
      dirty: false,
      foreign: true,
    });
    expect(localChangesFor(legacy, "user-1", "user-1")).toEqual({
      dirty: false,
      foreign: false,
    });
    // Cambios sin cuenta encima de datos de user-1: siguen siendo de user-1.
    expect(localChangesFor({ ...legacy, dirty: true }, "user-2", "user-1")).toEqual({
      dirty: false,
      foreign: true,
    });
    // El ownerId de los metadatos manda sobre lo que digan los datos.
    expect(
      localChangesFor({ ...legacy, ownerId: "user-2" }, "user-2", "user-1"),
    ).toEqual({ dirty: false, foreign: false });
  });
});
