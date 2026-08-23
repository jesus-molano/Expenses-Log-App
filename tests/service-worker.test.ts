import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker offline shell", () => {
  it("injects the build manifest and keeps remote data network-only", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "pwa", "sw.ts"),
      "utf8",
    );
    const config = readFileSync(
      join(process.cwd(), "serwist.config.mjs"),
      "utf8",
    );

    expect(source).toContain("precacheEntries: self.__SW_MANIFEST");
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain("matcher: ({ sameOrigin }) => !sameOrigin");
    expect(source.match(/handler: new NetworkOnly\(\)/g)).toHaveLength(2);
    expect(source).toContain('request.method === "GET"');
    expect(source).toContain('url.searchParams.has("_rsc")');
    expect(source).toContain('cacheName: "pages-rsc"');
    expect(source).toContain('url: "/"');
    expect(config).not.toContain("precachePrerendered: false");
    expect(config).toContain('{ url: "/settings", revision: buildRevision }');
    expect(config).toContain(
      '{ url: "/settings?from=money", revision: buildRevision }',
    );
  });
});
