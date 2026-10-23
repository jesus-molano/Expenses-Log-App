import { describe, expect, it } from "vitest";
import {
  OFFLINE_STATUS_RESPONSE,
  PRECACHE_FAILED_MESSAGE,
  countCachedPrecacheKeys,
  describePrecacheUrl,
  isLegacyCacheName,
  isOfflineStatusResponse,
  isPrecacheFailedMessage,
  isTransientStatus,
} from "./cache-policy";

describe("cache policy", () => {
  it("retries only rate limits and server errors", () => {
    expect(isTransientStatus(429)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientStatus(404)).toBe(false);
    expect(isTransientStatus(200)).toBe(false);
  });

  it("describes precache URLs without origin or Serwist revision", () => {
    expect(
      describePrecacheUrl(
        "https://app.example/settings?from=money&__WB_REVISION__=abc",
      ),
    ).toBe("/settings?from=money");
    expect(describePrecacheUrl("https://app.example/_next/static/a.js")).toBe(
      "/_next/static/a.js",
    );
  });

  it("counts each expected precache key once", () => {
    expect(
      countCachedPrecacheKeys(
        ["https://a/1", "https://a/2", "https://a/2", "https://a/3"],
        ["https://a/2", "https://a/3", "https://a/other"],
      ),
    ).toBe(2);
  });

  it("recognises the hand-written service worker cache", () => {
    expect(isLegacyCacheName("expense-reminders-v6")).toBe(true);
    expect(isLegacyCacheName("serwist-precache-v2-https://a/")).toBe(false);
  });

  it("validates service worker messages", () => {
    expect(
      isOfflineStatusResponse({
        type: OFFLINE_STATUS_RESPONSE,
        expected: 41,
        cached: 41,
      }),
    ).toBe(true);
    expect(isOfflineStatusResponse({ type: OFFLINE_STATUS_RESPONSE })).toBe(
      false,
    );
    expect(
      isPrecacheFailedMessage({
        type: PRECACHE_FAILED_MESSAGE,
        url: "/settings",
        status: 500,
      }),
    ).toBe(true);
    expect(isPrecacheFailedMessage(null)).toBe(false);
  });
});
