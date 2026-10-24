import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker offline shell", () => {
  it("injects the build manifest and keeps remote data network-only", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "pwa", "sw.ts"),
      "utf8",
    );
    const config = readFileSync(
      join(process.cwd(), "serwist.config.mjs"),
      "utf8",
    );

    expect(source).toContain("precacheEntries: self.__SW_MANIFEST");
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain("matcher: ({ sameOrigin }) => !sameOrigin");
    expect(source.match(/handler: new NetworkOnly\(\)/g)).toHaveLength(3);
    expect(source).toContain('url.pathname.startsWith("/auth/")');
    expect(source).toContain('request.method === "GET"');
    expect(source).toContain('url.searchParams.has("_rsc")');
    expect(source).toContain('cacheName: "pages-rsc"');
    expect(source).toContain('url: "/"');
    expect(source).toContain("concurrency: 4");
    expect(source).toContain("plugins: [precacheDiagnosticsPlugin]");
    expect(source).toContain('event?.type !== "install"');
    expect(source).toContain("OFFLINE_STATUS_REQUEST");
    expect(source).toContain("serwist.getUrlsToPrecacheKeys()");
    expect(config).not.toContain("precachePrerendered: false");
  });

  it("serves precached routes without waiting on a hanging network", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "pwa", "sw.ts"),
      "utf8",
    );

    expect(source).toContain("navigationPreload: false");
    expect(source).toContain("disableNavigationPreload();");
    expect(source).toContain(
      "ignoreURLParametersMatching: PRECACHE_IGNORED_URL_PARAMS",
    );
    expect(source.match(/abortIfNoResponse\(NETWORK_RESPONSE_TIMEOUT_MS\)/g))
      .toHaveLength(4);
    // Navegación entre pestañas: si el RSC no llega, Next recarga el documento
    // y lo sirve el precache.
    expect(source).toContain("abortIfNoResponse(RSC_RESPONSE_TIMEOUT_MS)");
    // /api y peticiones externas: solo red, sin cortar respuestas lentas.
    expect(source).not.toMatch(/new NetworkOnly\(\{/);
    expect(source).toContain(".filter(isObsoleteCacheName)");
  });

  it("precaches /settings as a static route without query variants", () => {
    const config = readFileSync(
      join(process.cwd(), "serwist.config.mjs"),
      "utf8",
    );
    const settingsPage = readFileSync(
      join(process.cwd(), "src", "app", "settings", "page.tsx"),
      "utf8",
    );

    expect(config).not.toContain("additionalPrecacheEntries");
    expect(config).toContain('globIgnores: ["public/app-icon-1024.png"]');
    expect(settingsPage).not.toContain("searchParams");
  });

  it("renews push subscriptions and shows localized reminders", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "pwa", "sw.ts"),
      "utf8",
    );

    // M12: el navegador renueva la suscripción y el servidor se entera.
    expect(source).toContain('self.addEventListener("pushsubscriptionchange"');
    expect(source).toContain('fetch("/api/push/subscribe"');
    expect(source).toContain("previous?.options.applicationServerKey");
    // El payload se valida, abre solo rutas del mismo origen y actualiza el
    // número del icono.
    expect(source).toContain("parsePushPayload(");
    expect(source).toContain("resolveNotificationUrl(");
    expect(source).toContain("setAppBadge");
    expect(source).toContain('badge: "/badge-96.png?v=1"');
    // Enfoca antes de navegar (la activación del usuario es de la ventana).
    expect(source.indexOf("existingClient.focus()")).toBeLessThan(
      source.indexOf("focused.navigate(targetUrl)"),
    );
  });
});
