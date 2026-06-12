import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker offline shell", () => {
  it("pre-caches and falls back to the app shell for navigation", () => {
    const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

    expect(source).toContain('const OFFLINE_URL = "/"');
    expect(source).toContain("APP_SHELL_ASSETS = [");
    expect(source).toContain("caches.match(OFFLINE_URL)");
  });
});
