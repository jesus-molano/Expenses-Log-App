import { expect, test } from "@playwright/test";
import { DEPLOYMENT_ID, ensureDeploymentBuild } from "./deployment-build";
import {
  ORIGIN,
  expectOfflineColdStart,
  releaseResources,
  startServer,
} from "./harness";

let deploymentDir = "";

test.beforeAll(async () => {
  // Incluye un `npm run build` completo la primera vez.
  test.setTimeout(10 * 60_000);
  deploymentDir = await ensureDeploymentBuild();
});

test.afterEach(releaseResources);

test("opens every main route offline from a build with a deployment id (dead network)", async ({
  browserName,
}) => {
  // Vercel también da el id al servidor en tiempo de ejecución.
  await startServer({
    dir: deploymentDir,
    env: { NEXT_DEPLOYMENT_ID: DEPLOYMENT_ID },
  });
  // Sin ?dpl= en el HTML este escenario no probaría nada.
  const html = await (await fetch(`${ORIGIN}/`)).text();
  expect(html).toContain(`?dpl=${DEPLOYMENT_ID}`);

  const served = await expectOfflineColdStart(browserName, "dead");
  // Los assets se pidieron con ?dpl= y salieron de las cachés del service
  // worker, que los guardan sin el parámetro.
  expect(served.some((url) => url.includes(`dpl=${DEPLOYMENT_ID}`))).toBe(true);
});
