import { spawn } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ROOT } from "./harness";

// Build con NEXT_DEPLOYMENT_ID, como el de Vercel con Skew Protection: el HTML
// y el runtime de Next piden los assets con ?dpl=<id>, mientras que el
// precache los guarda sin él.
export const DEPLOYMENT_ID = "dpl_e2e";

const BUILDS_DIR = join(ROOT, ".e2e-builds");
const DEPLOYMENT_DIR = join(BUILDS_DIR, "dpl");
const BASE_BACKUP_DIR = join(BUILDS_DIR, "base");
const NEXT_DIR = join(ROOT, ".next");
const SW_FILE = join(ROOT, "public", "sw.js");
const BUILD_LOG = join(BUILDS_DIR, "dpl-build.log");

// Compila en la raíz (mismas rutas y configuración que el build base, que se
// aparta mientras tanto) y deja el resultado en .e2e-builds/dpl, un directorio
// que `next start` sirve tal cual. Se reutiliza mientras el build base sea el
// mismo: rehacerlo cuesta lo que un `npm run build`.
export async function ensureDeploymentBuild() {
  recoverBaseBuild();
  const baseBuildId = readText(join(NEXT_DIR, "BUILD_ID"));
  if (!baseBuildId) {
    throw new Error("Run `npm run build` before the offline harness");
  }
  if (
    readText(join(DEPLOYMENT_DIR, "base-build-id")) === baseBuildId &&
    readText(join(DEPLOYMENT_DIR, ".next", "BUILD_ID"))
  ) {
    return DEPLOYMENT_DIR;
  }

  rmSync(DEPLOYMENT_DIR, { recursive: true, force: true });
  rmSync(BASE_BACKUP_DIR, { recursive: true, force: true });
  mkdirSync(BASE_BACKUP_DIR, { recursive: true });
  copyFileSync(SW_FILE, join(BASE_BACKUP_DIR, "sw.js"));
  renameSync(NEXT_DIR, join(BASE_BACKUP_DIR, ".next"));
  try {
    await runDeploymentBuild();
    mkdirSync(DEPLOYMENT_DIR, { recursive: true });
    cpSync(join(ROOT, "public"), join(DEPLOYMENT_DIR, "public"), {
      recursive: true,
    });
    copyFileSync(
      join(ROOT, "next.config.ts"),
      join(DEPLOYMENT_DIR, "next.config.ts"),
    );
    renameSync(NEXT_DIR, join(DEPLOYMENT_DIR, ".next"));
    // La caché de compilación no hace falta para servir.
    rmSync(join(DEPLOYMENT_DIR, ".next", "cache"), {
      recursive: true,
      force: true,
    });
    writeFileSync(join(DEPLOYMENT_DIR, "base-build-id"), baseBuildId);
  } finally {
    restoreBaseBuild();
  }
  return DEPLOYMENT_DIR;
}

// Una ejecución cortada a mitad del build deja el build base apartado: se
// devuelve a su sitio, salvo que entretanto se haya hecho un build nuevo.
export function recoverBaseBuild() {
  if (!existsSync(join(BASE_BACKUP_DIR, ".next"))) return;
  if (readText(join(NEXT_DIR, "BUILD_ID")) && !isDeploymentBuild(NEXT_DIR)) {
    rmSync(BASE_BACKUP_DIR, { recursive: true, force: true });
    return;
  }
  restoreBaseBuild();
}

function restoreBaseBuild() {
  const backup = join(BASE_BACKUP_DIR, ".next");
  if (!existsSync(backup)) return;
  rmSync(NEXT_DIR, { recursive: true, force: true });
  renameSync(backup, NEXT_DIR);
  copyFileSync(join(BASE_BACKUP_DIR, "sw.js"), SW_FILE);
  rmSync(BASE_BACKUP_DIR, { recursive: true, force: true });
}

function isDeploymentBuild(nextDir: string) {
  try {
    const serverFiles = JSON.parse(
      readFileSync(join(nextDir, "required-server-files.json"), "utf8"),
    ) as { config?: { deploymentId?: string } };
    return serverFiles.config?.deploymentId === DEPLOYMENT_ID;
  } catch {
    return false;
  }
}

function runDeploymentBuild() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Con NODE_ENV=development Serwist no inyecta el manifiesto del precache.
    NODE_ENV: "production",
    NEXT_DEPLOYMENT_ID: DEPLOYMENT_ID,
  };

  return new Promise<void>((resolve, reject) => {
    const output: Buffer[] = [];
    const child = spawn("npm", ["run", "build"], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => output.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      const log = Buffer.concat(output).toString("utf8");
      writeFileSync(BUILD_LOG, log);
      if (code === 0) return resolve();
      reject(
        new Error(
          `Deployment build failed (${BUILD_LOG}):\n${log.split("\n").slice(-30).join("\n")}`,
        ),
      );
    });
  });
}

function readText(file: string) {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}
