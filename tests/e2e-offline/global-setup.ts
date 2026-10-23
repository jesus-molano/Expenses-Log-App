import { recoverBaseBuild } from "./deployment-build";

// Antes de cualquier escenario: si una ejecución anterior se cortó mientras
// compilaba el build con NEXT_DEPLOYMENT_ID, el build base vuelve a .next.
export default function globalSetup() {
  recoverBaseBuild();
}
