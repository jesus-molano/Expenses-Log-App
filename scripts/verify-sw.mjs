// Comprueba el service worker generado por `serwist build`. Una entrada que
// falte, esté duplicada o lleve query rompe el modo sin conexión en silencio:
// es mejor que falle el build.
import { readFileSync } from "node:fs";

// Las cuatro pestañas, Ajustes, el login y el atajo "Añadir gasto".
const REQUIRED_ROUTES = [
  "/",
  "/money",
  "/accounts",
  "/forecast",
  "/settings",
  "/login",
  "/expenses/new",
];

const source = readFileSync("public/sw.js", "utf8");
// Solo las entradas del manifiesto: objetos con `url` y `revision` (en otros
// sitios del service worker, como `fallbacks`, también aparece `url`).
const urls = Array.from(source.matchAll(/\{[^{}]*\}/g), ([entry]) => entry)
  .filter((entry) => /["']?revision["']?\s*:/.test(entry))
  .map((entry) => entry.match(/["']?url["']?\s*:\s*["']([^"']+)["']/)?.[1])
  .filter(Boolean);
const problems = [];

for (const route of REQUIRED_ROUTES) {
  if (!urls.includes(route)) problems.push(`missing route ${route}`);
}

const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
if (duplicates.length) {
  problems.push(`duplicate entries ${[...new Set(duplicates)].join(", ")}`);
}

const withQuery = urls.filter((url) => url.includes("?"));
if (withQuery.length) {
  problems.push(`entries with query ${withQuery.join(", ")}`);
}

if (!urls.some((url) => url.startsWith("/_next/static/"))) {
  problems.push("no /_next/static assets");
}

if (problems.length) {
  console.error(`Service worker precache check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

console.log(`Service worker precache check passed (${urls.length} entries).`);
