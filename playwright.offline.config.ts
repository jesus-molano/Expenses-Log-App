import { defineConfig } from "@playwright/test";

// Escenarios de arranque en frío sin conexión. Necesitan un build previo
// (`npm run build`) porque cada test arranca y para su propio `next start`.
export default defineConfig({
  testDir: "./tests/e2e-offline",
  workers: 1,
  timeout: 180_000,
  use: {
    trace: "retain-on-failure",
  },
});
