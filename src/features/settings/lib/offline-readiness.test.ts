import { describe, expect, it } from "vitest";
import {
  resolveOfflineReadiness,
  shouldClearOfflineDiagnostic,
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

  it("only blames the legacy worker when its cache is present", () => {
    expect(resolveOfflineReadiness({ ...base, hasLegacyCache: true })).toBe(
      "legacy",
    );
    expect(resolveOfflineReadiness(base)).toBe("unknown");
  });

  it("reports a missing service worker", () => {
    expect(resolveOfflineReadiness({ ...base, hasRegistration: false })).toBe(
      "missing",
    );
  });
});

describe("shouldClearOfflineDiagnostic", () => {
  it("keeps a failure while a newer worker is still installing", () => {
    expect(
      shouldClearOfflineDiagnostic({ readiness: "ready", isInstalling: true }),
    ).toBe(false);
    expect(
      shouldClearOfflineDiagnostic({ readiness: "ready", isInstalling: false }),
    ).toBe(true);
    expect(
      shouldClearOfflineDiagnostic({ readiness: "failed", isInstalling: false }),
    ).toBe(false);
  });
});
