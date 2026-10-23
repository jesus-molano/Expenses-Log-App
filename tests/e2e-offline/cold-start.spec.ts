import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chromium,
  devices,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { demoStore } from "../../src/domain/seed";

const PORT = 3200;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const STORAGE_KEY = "expense-log-store-v1";
// En entornos con un Chromium preinstalado distinto al de Playwright.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...pixel7 } = devices["Pixel 7"];

const ROUTES: Array<[string, (page: Page) => ReturnType<Page["getByText"]>]> = [
  ["/", (page) => page.getByText("Por pagar")],
  ["/money", (page) => page.getByRole("heading", { level: 1, name: /Plan de/ })],
  [
    "/settings?from=money",
    (page) => page.getByRole("heading", { level: 1, name: "Ajustes" }),
  ],
  ["/expenses/new", (page) => page.getByText("Por pagar")],
  ["/login", (page) => page.getByRole("heading", { name: "Entrar con Google" })],
];

for (const mode of ["dead", "blackhole"] as const) {
  test(`opens every main route on an offline cold start (${mode} network)`, async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), "expenses-offline-"));
    const server = await startNextServer();
    let blackhole: Server | null = null;
    let context: BrowserContext | null = null;

    try {
      context = await launch(userDataDir);
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/`);
      await expect(page.getByText("Por pagar")).toBeVisible();
      await waitForOfflineReady(page);
      // Chromium guarda el registro del service worker de forma asíncrona:
      // cerrar justo tras activarlo lo pierde. Se exige una navegación servida
      // por el service worker y un margen antes de cerrar.
      const reload = await page.reload();
      expect(reload?.fromServiceWorker()).toBe(true);
      await page.waitForTimeout(3_000);
      await context.close();

      await stopNextServer(server);
      if (mode === "blackhole") blackhole = await startBlackhole();

      context = await launch(userDataDir);
      for (const [path, locator] of ROUTES) {
        const routePage = await context.newPage();
        const failedAssets: string[] = [];
        routePage.on("requestfailed", (request) => {
          if (request.url().includes("/_next/static/")) {
            failedAssets.push(request.url());
          }
        });
        await routePage.goto(`${ORIGIN}${path}`, {
          waitUntil: "commit",
          timeout: 10_000,
        });
        await expect(locator(routePage), path).toBeVisible({ timeout: 5_000 });
        expect(failedAssets, path).toEqual([]);
        await routePage.close();
      }
    } finally {
      await context?.close().catch(() => undefined);
      await stopNextServer(server);
      blackhole?.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });
}

async function launch(userDataDir: string) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...pixel7,
    executablePath,
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

async function waitForOfflineReady(page: Page) {
  // page.evaluate espera a la promesa; waitForFunction con polling numérico
  // daría por bueno el objeto Promise al instante.
  await waitFor(
    () =>
      page.evaluate(async () => {
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
      }),
    60_000,
  );
}

function startNextServer(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
    { stdio: "ignore", detached: true },
  );

  return waitFor(async () => {
    const response = await fetch(ORIGIN).catch(() => null);
    return response?.ok ?? false;
  }, 30_000).then(() => child);
}

async function stopNextServer(child: ChildProcess) {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  await waitFor(async () => !(await fetch(ORIGIN).catch(() => null)), 10_000);
}

// Acepta conexiones y nunca responde: como una red móvil sin cobertura real.
function startBlackhole(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(() => undefined);
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
