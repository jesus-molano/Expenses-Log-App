import { describe, expect, it } from "vitest";
import {
  OFFLINE_STATUS_RESPONSE,
  PRECACHE_FAILED_MESSAGE,
  PRECACHE_IGNORED_URL_PARAMS,
  countCachedPrecacheKeys,
  describePrecacheUrl,
  isLegacyCacheName,
  isObsoleteCacheName,
  isOfflineStatusResponse,
  isPrecacheFailedMessage,
  isTransientStatus,
  stripDeploymentQuery,
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

  it("drops per-build and legacy caches but keeps precache and assets", () => {
    expect(isObsoleteCacheName("expense-reminders-v6")).toBe(true);
    expect(isObsoleteCacheName("pages")).toBe(true);
    expect(isObsoleteCacheName("pages-rsc")).toBe(true);
    expect(isObsoleteCacheName("next-static")).toBe(false);
    expect(isObsoleteCacheName("serwist-precache-v2-https://a/")).toBe(false);
  });

  it("ignores client-only and deployment params when matching the precache", () => {
    const ignored = (param: string) =>
      PRECACHE_IGNORED_URL_PARAMS.some((pattern) => pattern.test(param));

    expect(["dpl", "from", "mode", "occurrence", "utm_source"].every(ignored))
      .toBe(true);
    expect(ignored("_rsc")).toBe(false);
    expect(
      stripDeploymentQuery("https://a/_next/static/x.js?dpl=dpl_1&v=2"),
    ).toBe("https://a/_next/static/x.js?v=2");
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
