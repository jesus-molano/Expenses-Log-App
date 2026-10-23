import { describe, expect, it } from "vitest";
import {
  OFFLINE_DIAGNOSTIC_KEY,
  clearOfflineDiagnostic,
  parseOfflineDiagnostic,
  readOfflineDiagnostic,
  resolveOfflineReadiness,
  writeOfflineDiagnostic,
} from "./offline-readiness";

const base = {
  supported: true,
  hasRegistration: true,
  isInstalling: false,
  status: null,
  hasLegacyCache: false,
  lastFailure: null,
};

describe("resolveOfflineReadiness", () => {
  it("reports unsupported browsers", () => {
    expect(resolveOfflineReadiness({ ...base, supported: false })).toBe(
      "unsupported",
    );
  });

  it("is ready when every precache entry is cached, even after an old failure", () => {
    expect(
      resolveOfflineReadiness({
        ...base,
        status: { expected: 41, cached: 41 },
        lastFailure: { at: "2026-10-23T10:00:00.000Z", url: "/x", status: 500 },
      }),
    ).toBe("ready");
  });

  it("reports the last install failure when not ready", () => {
    expect(
      resolveOfflineReadiness({
        ...base,
        lastFailure: { at: "2026-10-23T10:00:00.000Z", url: "/x", status: 429 },
      }),
    ).toBe("failed");
  });

  it("is preparing while installing or partially cached", () => {
    expect(resolveOfflineReadiness({ ...base, isInstalling: true })).toBe(
      "preparing",
    );
    expect(
      resolveOfflineReadiness({ ...base, status: { expected: 41, cached: 12 } }),
    ).toBe("preparing");
  });

  it("detects the legacy service worker that does not answer", () => {
    expect(resolveOfflineReadiness(base)).toBe("legacy");
    expect(
      resolveOfflineReadiness({
        ...base,
        hasRegistration: false,
        hasLegacyCache: true,
      }),
    ).toBe("legacy");
  });

  it("reports a missing service worker", () => {
    expect(resolveOfflineReadiness({ ...base, hasRegistration: false })).toBe(
      "missing",
    );
  });
});

describe("offline diagnostics storage", () => {
  it("writes, reads and clears the last failure", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };

    writeOfflineDiagnostic(
      { url: "/settings?from=money", status: 503 },
      new Date("2026-10-23T10:00:00.000Z"),
      storage,
    );
    expect(readOfflineDiagnostic(storage)).toEqual({
      at: "2026-10-23T10:00:00.000Z",
      url: "/settings?from=money",
      status: 503,
    });

    clearOfflineDiagnostic(storage);
    expect(values.has(OFFLINE_DIAGNOSTIC_KEY)).toBe(false);
  });

  it("ignores malformed values", () => {
    expect(parseOfflineDiagnostic("{")).toBeNull();
    expect(parseOfflineDiagnostic(JSON.stringify({ url: 1 }))).toBeNull();
  });
});
