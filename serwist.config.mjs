import { readFileSync } from "node:fs";
import { serwist } from "@serwist/next/config";

const buildRevision = readFileSync(".next/BUILD_ID", "utf8").trim();

export default serwist({
  swSrc: "src/pwa/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [
    { url: "/settings", revision: buildRevision },
    { url: "/settings?from=expenses", revision: buildRevision },
    { url: "/settings?from=money", revision: buildRevision },
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  esbuildOptions: {
    minify: true,
    sourcemap: false,
  },
});
