import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT_PATH, resolveSafeRedirectPath } from "./safe-redirect";

const origin = "https://gastos.example.app";

describe("resolveSafeRedirectPath", () => {
  it.each([
    ["/settings", "/settings"],
    ["/money?from=expenses", "/money?from=expenses"],
    ["/expenses/new?mode=voice#capture", "/expenses/new?mode=voice#capture"],
    ["/", "/"],
    ["/a/../money", "/money"],
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"],
  ])("keeps the internal path %s", (next, expected) => {
    expect(resolveSafeRedirectPath(next, origin)).toBe(expected);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["absolute https URL", "https://evil.example/settings"],
    ["absolute URL of the same origin", `${origin}/settings`],
    ["javascript URL", "javascript:alert(1)"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with path", "//evil.example/settings"],
    ["backslash after slash", "/\\evil.example"],
    ["backslash later", "/settings\\..\\..\\evil"],
    ["tab (%09)", "/\t/evil.example"],
    ["newline (%0A)", "/\n/evil.example"],
    ["carriage return (%0D)", "/\r/evil.example"],
    ["NUL", "/\u0000/evil.example"],
    ["DEL", "/\u007F/evil.example"],
    ["dot segment to double slash", "/.//evil.example"],
    ["parent segment to double slash", "/..//evil.example"],
    ["encoded parent segment to double slash", "/%2e%2e//evil.example"],
    ["relative path", "settings"],
    ["still encoded", "%2F%2Fevil.example"],
  ])("falls back for %s", (_label, next) => {
    expect(resolveSafeRedirectPath(next, origin)).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("never returns something a browser would read as another host", () => {
    const attempts = [
      "/\t/evil.example",
      "/.//evil.example",
      "/\\evil.example",
      "//evil.example",
      "/%09/evil.example",
      "/%5Cevil.example",
    ];

    for (const next of attempts) {
      const resolved = new URL(resolveSafeRedirectPath(next, origin), origin);
      expect(resolved.origin).toBe(origin);
    }
  });
});
