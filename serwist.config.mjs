import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "src/pwa/sw.ts",
  swDest: "public/sw.js",
  // /settings es estática y entra por precachePrerendered; las variantes con
  // ?from= la reutilizan vía ignoreURLParametersMatching en el service worker.
  globIgnores: ["public/app-icon-1024.png"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  esbuildOptions: {
    minify: true,
    sourcemap: false,
  },
});
