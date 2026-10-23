import { existsSync } from "node:fs";
import { defineConfig, devices, webkit } from "@playwright/test";
import playwrightPackage from "@playwright/test/package.json";

// Antes de 1.64 el WebKit de Playwright rompe las peticiones que sirve el
// service worker (playwright#42775).
const WEBKIT_MIN_PLAYWRIGHT = [1, 64] as const;

// Motivo para saltar el proyecto WebKit en esta instalación, o undefined si
// puede correr. Nunca instala navegadores.
function webkitSkipReason() {
  const { version } = playwrightPackage;
  const [major, minor] = version.split(".").map(Number);
  const [minMajor, minMinor] = WEBKIT_MIN_PLAYWRIGHT;
  if (major < minMajor || (major === minMajor && minor < minMinor)) {
    return `WebKit needs Playwright ${minMajor}.${minMinor}+ (installed ${version}): older versions break service worker responses in WebKit (playwright#42775)`;
  }
  let executable = "";
  try {
    executable = webkit.executablePath();
  } catch {
    // Sin entrada de WebKit en el registro de navegadores.
  }
  if (!executable || !existsSync(executable)) {
    return "WebKit is not installed (npx playwright install webkit)";
  }
  return undefined;
}

// Escenarios de arranque en frío sin conexión. Necesitan un build previo
// (`npm run build`) porque cada test arranca y para su propio `next start`.
// El escenario con NEXT_DEPLOYMENT_ID compila además su propio build en
// .e2e-builds/ y lo reutiliza mientras el build base no cambie.
export default defineConfig({
  testDir: "./tests/e2e-offline",
  globalSetup: "./tests/e2e-offline/global-setup.ts",
  workers: 1,
  timeout: 180_000,
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-pixel7",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 15"] },
      // Solo cortes de red reales (servidor parado o que no responde): el
      // modo offline emulado no corta las peticiones del service worker.
      testMatch: "cold-start.spec.ts",
      metadata: { skipReason: webkitSkipReason() },
    },
  ],
});
