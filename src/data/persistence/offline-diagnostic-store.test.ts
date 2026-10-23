import { describe, expect, it } from "vitest";
import {
  OFFLINE_DIAGNOSTIC_KEY,
  clearOfflineDiagnostic,
  parseOfflineDiagnostic,
  readOfflineDiagnostic,
  writeOfflineDiagnostic,
} from "./offline-diagnostic-store";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("offline diagnostic store", () => {
  it("writes, reads and clears the last failure", () => {
    const storage = memoryStorage();

    writeOfflineDiagnostic(
      { url: "/settings", status: 503 },
      { now: new Date("2026-10-23T10:00:00.000Z"), storage },
    );
    expect(readOfflineDiagnostic(storage)).toEqual({
      at: "2026-10-23T10:00:00.000Z",
      url: "/settings",
      status: 503,
    });

    clearOfflineDiagnostic(storage);
    expect(storage.values.has(OFFLINE_DIAGNOSTIC_KEY)).toBe(false);
  });

  it("does not replace a detailed failure from the same install with a generic one", () => {
    const storage = memoryStorage();
    const startedAt = new Date("2026-10-23T10:00:00.000Z");

    writeOfflineDiagnostic(
      { url: "/money", status: 500 },
      { now: new Date("2026-10-23T10:00:05.000Z"), storage },
    );
    writeOfflineDiagnostic(
      { url: "", status: 0 },
      { now: new Date("2026-10-23T10:05:00.000Z"), keepDetailedSince: startedAt, storage },
    );
    expect(readOfflineDiagnostic(storage)?.url).toBe("/money");

    writeOfflineDiagnostic(
      { url: "", status: 0 },
      {
        now: new Date("2026-10-24T10:05:00.000Z"),
        keepDetailedSince: new Date("2026-10-24T10:00:00.000Z"),
        storage,
      },
    );
    expect(readOfflineDiagnostic(storage)?.url).toBe("");
  });

  it("ignores malformed values", () => {
    expect(parseOfflineDiagnostic("{")).toBeNull();
    expect(parseOfflineDiagnostic(JSON.stringify({ url: 1 }))).toBeNull();
  });
});
