import { test } from "@playwright/test";
import {
  expectOfflineColdStart,
  releaseResources,
  startServer,
} from "./harness";

test.beforeEach(() => {
  // El proyecto WebKit trae el motivo si esta instalación no puede correrlo.
  const skipReason = test.info().project.metadata.skipReason;
  test.skip(typeof skipReason === "string", String(skipReason));
});

test.afterEach(releaseResources);

for (const mode of ["dead", "blackhole"] as const) {
  test(`opens every main route on an offline cold start (${mode} network)`, async ({
    browserName,
  }) => {
    await startServer();
    await expectOfflineColdStart(browserName, mode);
  });
}
