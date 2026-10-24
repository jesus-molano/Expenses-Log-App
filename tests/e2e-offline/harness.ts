import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  chromium,
  expect,
  test,
  webkit,
  type BrowserContext,
  type Page,
  type PlaywrightWorkerOptions,
} from "@playwright/test";
import { demoStore } from "../../src/domain/seed";
import { NETWORK_RESPONSE_TIMEOUT_MS } from "../../src/pwa/cache-policy";

// Arranques en frío sin conexión contra un `next start` real. Cada test
// prepara un perfil con conexión, cierra el navegador, quita la red y vuelve a
// abrirlo con el mismo perfil.

export const ROOT = resolve(__dirname, "../..");
// El service worker queda atado al origen: el puerto es fijo dentro de una
// ejecución. Se puede cambiar para no chocar con otra ejecución en la máquina.
const PORT = Number(process.env.E2E_OFFLINE_PORT) || 3200;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
const STORAGE_KEY = "expense-log-store-v1";
// En entornos con un Chromium preinstalado distinto al de Playwright.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

// dead: el puerto rechaza conexiones, como el modo avión.
// blackhole: acepta conexiones y nunca responde, como unos datos móviles sin
// cobertura real.
export type OfflineMode = "dead" | "blackhole";
type BrowserName = PlaywrightWorkerOptions["browserName"];

const ROUTES: Array<[string, (page: Page) => ReturnType<Page["getByText"]>]> = [
  ["/", (page) => page.getByText("Por pagar")],
  ["/money", (page) => page.getByRole("heading", { level: 1, name: /Plan de/ })],
  ["/accounts", (page) => page.getByRole("region", { name: "Cuentas" })],
  ["/forecast", (page) => page.getByRole("region", { name: "Próximos recibos grandes" })],
  [
    "/settings?from=money",
    (page) => page.getByRole("heading", { level: 1, name: "Ajustes" }),
  ],
  ["/expenses/new", (page) => page.getByText("Por pagar")],
  ["/login", (page) => page.getByRole("heading", { name: "Entrar con Google" })],
];

// Recursos de cada test: los libera releaseResources en afterEach, que también
// corre cuando el test agota su tiempo.
const resources: {
  server: ChildProcess | null;
  blackhole: Server | null;
  context: BrowserContext | null;
  userDataDir: string | null;
} = { server: null, blackhole: null, context: null, userDataDir: null };

export async function releaseResources() {
  await resources.context?.close().catch(() => undefined);
  if (resources.server) await stopNextServer(resources.server);
  resources.blackhole?.close();
  if (resources.userDataDir) {
    rmSync(resources.userDataDir, { recursive: true, force: true });
  }
  resources.server = resources.blackhole = resources.context = null;
  resources.userDataDir = null;
}

type ServerOptions = {
  // Directorio que sirve `next start` (por defecto, el build de la raíz).
  dir?: string;
  env?: Record<string, string>;
};

export async function startServer(options: ServerOptions = {}) {
  resources.server = await startNextServer(options);
}

// Prepara el perfil con conexión, quita la red según `mode` y abre cada ruta
// principal en un arranque en frío. Devuelve los assets de /_next/static que
// se sirvieron sin conexión. Necesita startServer antes.
export async function expectOfflineColdStart(
  browserName: BrowserName,
  mode: OfflineMode,
) {
  if (!resources.server) throw new Error("startServer() must run first");
  resources.userDataDir = mkdtempSync(join(tmpdir(), "expenses-offline-"));

  resources.context = await launch(browserName, resources.userDataDir);
  const page = await resources.context.newPage();
  await page.goto(`${ORIGIN}/`);
  await expect(page.getByText("Por pagar")).toBeVisible();
  await waitForOfflineReady(page, browserName);
  // Chromium guarda el registro del service worker de forma asíncrona:
  // cerrar justo tras activarlo lo pierde. Se exige una navegación servida
  // por el service worker y un margen antes de cerrar.
  const reload = await page.reload();
  expect(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true);
  if (browserName === "chromium") {
    expect(reload?.fromServiceWorker()).toBe(true);
    // Sin la caché HTTP del navegador, como cuando iOS la vacía: lo que no
    // esté en las cachés del service worker no puede abrir sin red.
    const cdp = await resources.context.newCDPSession(page);
    await cdp.send("Network.clearBrowserCache");
    await cdp.detach();
  }
  await page.waitForTimeout(3_000);
  await resources.context.close();

  await stopNextServer(resources.server);
  resources.server = null;
  if (mode === "blackhole") resources.blackhole = await startBlackhole();

  resources.context = await launch(browserName, resources.userDataDir);
  const served: string[] = [];
  for (const [path, locator] of ROUTES) {
    const routePage = await resources.context.newPage();
    const staticRequests = trackStaticRequests(routePage);
    await routePage.goto(`${ORIGIN}${path}`, {
      waitUntil: "commit",
      timeout: 10_000,
    });
    await expect(locator(routePage), path).toBeVisible({ timeout: 5_000 });
    // Un chunk fuera del precache colgaría hasta el corte de red: se espera
    // a que no quede ninguno pendiente antes de dar la ruta por buena.
    await waitFor(
      async () => staticRequests.pending.size === 0,
      NETWORK_RESPONSE_TIMEOUT_MS + 2_000,
    );
    expect(staticRequests.failed, path).toEqual([]);
    served.push(...staticRequests.finished);
    await routePage.close();
  }

  // Una ruta fuera del precache espera a la red hasta el corte y cae en el
  // fallback "/" en lugar de colgarse.
  const fallbackPage = await resources.context.newPage();
  await fallbackPage.goto(`${ORIGIN}/expenses/${demoStore.templates[0].id}`, {
    waitUntil: "commit",
    timeout: NETWORK_RESPONSE_TIMEOUT_MS + 6_000,
  });
  await expect(fallbackPage.getByText("Por pagar")).toBeVisible({
    timeout: 5_000,
  });

  return served;
}

function trackStaticRequests(page: Page) {
  const pending = new Set<string>();
  const failed: string[] = [];
  const finished: string[] = [];
  const isStatic = (url: string) => url.includes("/_next/static/");
  page.on("request", (request) => {
    if (isStatic(request.url())) pending.add(request.url());
  });
  page.on("requestfinished", (request) => {
    if (pending.delete(request.url())) finished.push(request.url());
  });
  page.on("requestfailed", (request) => {
    pending.delete(request.url());
    if (isStatic(request.url())) failed.push(request.url());
  });
  return { pending, failed, finished };
}

// Contexto persistente con el dispositivo del proyecto (Pixel 7, iPhone 15).
async function launch(browserName: BrowserName, userDataDir: string) {
  if (browserName === "firefox") {
    throw new Error("The offline harness runs on Chromium and WebKit only");
  }
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    test.info().project.use;
  const browserType = browserName === "webkit" ? webkit : chromium;
  const context = await browserType.launchPersistentContext(userDataDir, {
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    executablePath: browserName === "chromium" ? chromiumExecutable : undefined,
  });
  await context.addInitScript(
    ({ key, store }) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(store));
      }
    },
    { key: STORAGE_KEY, store: demoStore },
  );
  return context;
}

async function waitForOfflineReady(page: Page, browserName: BrowserName) {
  try {
    await waitFor(() => readOfflineReady(page), 60_000);
  } catch (error) {
    // Si el WebKit de Playwright nunca deja el service worker al mando, el
    // escenario no prueba nada: se salta en lugar de darlo por bueno.
    test.skip(
      browserName === "webkit",
      "WebKit never got an activated service worker with a complete precache",
    );
    throw error;
  }
}

// page.evaluate espera a la promesa; waitForFunction con polling numérico
// daría por bueno el objeto Promise al instante.
function readOfflineReady(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active;
    if (!worker || registration?.installing || registration?.waiting) {
      return false;
    }
    const status = await new Promise<{
      expected: number;
      cached: number;
    } | null>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 1_000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
    });
    return Boolean(
      status && status.expected > 0 && status.cached >= status.expected,
    );
  });
}

async function startNextServer({ dir, env }: ServerOptions): Promise<ChildProcess> {
  // Un servidor que ya ocupa el puerto (de otro test o de un build viejo)
  // haría pasar el test contra algo que no es este build.
  if (await fetch(ORIGIN).catch(() => null)) {
    throw new Error(`Port ${PORT} is already in use`);
  }

  const child = spawn(
    process.execPath,
    [
      join(ROOT, "node_modules/next/dist/bin/next"),
      "start",
      ...(dir ? [dir] : []),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(PORT),
    ],
    { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore", detached: true },
  );

  try {
    await waitFor(async () => {
      if (hasExited(child)) throw new Error("next start exited early");
      const response = await fetch(ORIGIN).catch(() => null);
      return response?.ok ?? false;
    }, 30_000);
  } catch (error) {
    await stopNextServer(child);
    throw error;
  }
  return child;
}

function hasExited(child: ChildProcess) {
  return child.exitCode !== null || child.signalCode !== null;
}

// Se espera a que salga el proceso, no a que el puerto deje de responder: el
// cierre ordenado de Next atiende las conexiones abiertas, y sondear con fetch
// las mantiene vivas. Si no sale a tiempo, se fuerza.
async function stopNextServer(child: ChildProcess) {
  if (hasExited(child) || child.pid === undefined) return;
  signalGroup(child, "SIGTERM");
  try {
    await waitFor(async () => hasExited(child), 5_000);
  } catch {
    signalGroup(child, "SIGKILL");
    await waitFor(async () => hasExited(child), 5_000);
  }
  await waitFor(async () => !(await acceptsConnections()), 5_000);
}

// Conexión TCP suelta, sin el pool keep-alive de fetch.
function acceptsConnections() {
  return new Promise<boolean>((resolve) => {
    const socket = connect(PORT, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  // detached: el proceso encabeza su grupo y la señal llega también a sus
  // hijos.
  try {
    if (child.pid !== undefined) process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function startBlackhole(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(() => undefined);
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out after ${timeoutMs} ms`);
}
