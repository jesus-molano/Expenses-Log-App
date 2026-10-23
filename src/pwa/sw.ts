/// <reference lib="webworker" />

import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
  SerwistPlugin,
} from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  disableNavigationPreload,
} from "serwist";
import {
  NETWORK_RESPONSE_TIMEOUT_MS,
  RSC_RESPONSE_TIMEOUT_MS,
  OFFLINE_STATUS_REQUEST,
  OFFLINE_STATUS_RESPONSE,
  PRECACHE_FAILED_MESSAGE,
  PRECACHE_IGNORED_URL_PARAMS,
  PRECACHE_RETRY_DELAYS_MS,
  countCachedPrecacheKeys,
  describePrecacheUrl,
  isObsoleteCacheName,
  isTransientStatus,
  stripDeploymentQuery,
  type OfflineStatusResponse,
  type PrecacheFailedMessage,
} from "./cache-policy";
import { parsePushPayload, resolveNotificationUrl } from "./push-payload";
import {
  buildSubscriptionRenewal,
  urlBase64ToUint8Array,
} from "./push-subscription";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Aborta la petición si la red no devuelve cabeceras a tiempo, para que la
// estrategia caiga a la caché o al fallback en lugar de quedarse colgada.
// Solo corta la espera de la respuesta, no la descarga de un cuerpo lento.
function abortIfNoResponse(timeoutMs: number): SerwistPlugin {
  return {
    requestWillFetch: async ({ request, state }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      if (state) state.abortTimer = timer;
      return new Request(request, { signal: controller.signal });
    },
    fetchDidSucceed: async ({ response, state }) => {
      clearTimeout(state?.abortTimer as ReturnType<typeof setTimeout>);
      return response;
    },
    fetchDidFail: async ({ state }) => {
      clearTimeout(state?.abortTimer as ReturnType<typeof setTimeout>);
    },
  };
}

// Vercel añade ?dpl=<despliegue> a los assets con Skew Protection; la clave de
// caché no debe depender de él para que un asset cacheado siga sirviendo.
const ignoreDeploymentQuery: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => stripDeploymentQuery(request.url),
};

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // El callback de OAuth lleva un código de un solo uso: sin caché, sin corte
  // por tiempo y sin el fallback a "/".
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/auth/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin }) => !sameOrigin,
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      request.method === "GET" &&
      sameOrigin &&
      url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [
        ignoreDeploymentQuery,
        abortIfNoResponse(NETWORK_RESPONSE_TIMEOUT_MS),
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      request.method === "GET" && sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
      plugins: [
        abortIfNoResponse(NETWORK_RESPONSE_TIMEOUT_MS),
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 7 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      request.method === "GET" &&
      sameOrigin &&
      ["font", "image", "script", "style"].includes(request.destination),
    handler: new StaleWhileRevalidate({
      cacheName: "app-assets",
      plugins: [
        ignoreDeploymentQuery,
        abortIfNoResponse(NETWORK_RESPONSE_TIMEOUT_MS),
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      request.method === "GET" &&
      sameOrigin &&
      (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1"),
    handler: new NetworkFirst({
      cacheName: "pages-rsc",
      networkTimeoutSeconds: RSC_RESPONSE_TIMEOUT_MS / 1000,
      plugins: [
        abortIfNoResponse(RSC_RESPONSE_TIMEOUT_MS),
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) =>
      request.method === "GET" && sameOrigin,
    handler: new NetworkFirst({
      cacheName: "same-origin",
      networkTimeoutSeconds: 3,
      plugins: [
        abortIfNoResponse(NETWORK_RESPONSE_TIMEOUT_MS),
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
];

// Rechaza la instalación en curso. Serwist 9.5 no propaga los fallos del
// precache (su `parallel` deja la promesa colgada) y el navegador tardaría
// minutos en abandonar la instalación.
let failCurrentInstall: ((error: Error) => void) | null = null;

// La instalación del precache es todo o nada: una sola URL con error deja
// activo el service worker anterior. Reintenta los errores temporales y avisa a
// la app de la URL que falla para poder diagnosticarlo desde Ajustes.
const precacheDiagnosticsPlugin: SerwistPlugin = {
  fetchDidSucceed: async ({ event, request, response }) => {
    if (event?.type !== "install") return response;
    let current = response;
    for (const delay of PRECACHE_RETRY_DELAYS_MS) {
      if (!isTransientStatus(current.status)) break;
      await wait(delay);
      try {
        current = await fetch(request.clone());
      } catch {
        break;
      }
    }
    if (current.status >= 400) {
      await reportPrecacheFailure(request.url, current.status);
      failCurrentInstall?.(new Error(`Precache failed: ${request.url}`));
    }
    return current;
  },
  fetchDidFail: async ({ event, request }) => {
    if (event?.type !== "install") return;
    await reportPrecacheFailure(request.url, 0);
    failCurrentInstall?.(new Error(`Precache failed: ${request.url}`));
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 4,
    ignoreURLParametersMatching: PRECACHE_IGNORED_URL_PARAMS,
    plugins: [precacheDiagnosticsPlugin],
  },
  skipWaiting: true,
  clientsClaim: true,
  // Con navigation preload, una ruta precacheada espera a la respuesta de red
  // precargada antes de usar la caché; si la red se cuelga, la app no abre.
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Equivale a serwist.addEventListeners(), pero la instalación falla en cuanto
// una entrada del precache falla, en lugar de quedarse colgada. Chromium no da
// por fallida la instalación hasta que se resuelven todas las promesas de
// waitUntil, así que Serwist recibe un evento cuyo waitUntil no registra la
// suya: la única que cuenta es la carrera entre su éxito y el fallo.
self.addEventListener("install", (event) => {
  const failed = new Promise<never>((_, reject) => {
    failCurrentInstall = reject;
  });
  const installEvent = new Proxy(event, {
    get(target, property) {
      if (property === "waitUntil") return () => undefined;
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  event.waitUntil(
    Promise.race([serwist.handleInstall(installEvent), failed]).finally(() => {
      failCurrentInstall = null;
    }),
  );
});
self.addEventListener("activate", serwist.handleActivate);
self.addEventListener("fetch", serwist.handleFetch);
self.addEventListener("message", serwist.handleCache);

// navigationPreload: false no basta: la preferencia vive en el registro y la
// activó la versión anterior.
disableNavigationPreload();

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(isObsoleteCacheName)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reportPrecacheFailure(url: string, status: number) {
  const message: PrecacheFailedMessage = {
    type: PRECACHE_FAILED_MESSAGE,
    url: describePrecacheUrl(url),
    status,
  };
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  windowClients.forEach((client) => client.postMessage(message));
}

async function readOfflineStatus(): Promise<OfflineStatusResponse> {
  const expectedKeys = Array.from(serwist.getUrlsToPrecacheKeys().values());
  const cache = await caches.open(serwist.precacheStrategy.cacheName);
  const cachedUrls = (await cache.keys()).map((request) => request.url);

  return {
    type: OFFLINE_STATUS_RESPONSE,
    expected: new Set(expectedKeys).size,
    cached: countCachedPrecacheKeys(expectedKeys, cachedUrls),
  };
}

self.addEventListener("message", (event) => {
  const [port] = event.ports;
  if (event.data?.type !== OFFLINE_STATUS_REQUEST || !port) return;

  event.waitUntil(
    readOfflineStatus()
      .then((status) => port.postMessage(status))
      .catch(() => port.postMessage(null)),
  );
});

function readPushPayload(event: PushEvent) {
  try {
    return parsePushPayload(event.data?.json());
  } catch {
    return parsePushPayload(undefined);
  }
}

type BadgeNavigator = WorkerNavigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

// El número del icono (vencidos y de hoy) llega con cada aviso: así se
// actualiza aunque la app lleve días sin abrirse.
async function updateAppBadge(count: number | undefined) {
  const badgeNavigator = self.navigator as BadgeNavigator;
  if (count === undefined || !badgeNavigator.setAppBadge) return;
  try {
    if (count > 0) await badgeNavigator.setAppBadge(count);
    else await badgeNavigator.clearAppBadge?.();
  } catch {
    // Sin permiso de badge (o sin instalar) no hay nada que hacer.
  }
}

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png?v=5",
        // Silueta blanca con transparencia: Android la pinta en la barra de
        // estado (un PNG opaco sale como un cuadrado).
        badge: "/badge-96.png?v=1",
        lang: payload.lang,
        tag: payload.tag,
        data: { url: payload.url },
      }),
      updateAppBadge(payload.badgeCount),
    ]),
  );
});

// Enfoca la app si ya está abierta y la lleva a la URL del aviso; si no, abre
// una ventana. `navigate` solo funciona en ventanas que controla este worker.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(
    event.notification.data?.url,
    self.location.origin,
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const existingClient = windowClients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (existingClient) {
          const focused = await existingClient.focus().catch(() => existingClient);
          try {
            await focused.navigate(targetUrl);
            return;
          } catch {
            // Ventana sin controlar: se abre otra con la URL.
          }
        }

        await self.clients.openWindow(targetUrl);
      }),
  );
});

// El navegador renueva o invalida la suscripción (caducidad, cambio del
// servicio push). Se vuelve a suscribir con la misma clave y se avisa al
// servidor para que no siga enviando a la antigua.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    renewPushSubscription(event.oldSubscription, event.newSubscription).catch(
      (error: unknown) => {
        console.error("Push subscription renewal failed", error);
      },
    ),
  );
});

async function renewPushSubscription(
  previous: PushSubscription | null,
  next: PushSubscription | null,
) {
  let subscription = next;
  if (!subscription) {
    const applicationServerKey =
      previous?.options.applicationServerKey ?? (await fetchPublicKey());
    if (!applicationServerKey) return;
    subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const renewal = buildSubscriptionRenewal(subscription.toJSON(), previous?.endpoint);
  if (!renewal) return;
  // Con la cookie de sesión: sin sesión responde 401 y el latido de la app
  // la registrará al volver a abrirla.
  await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(renewal),
  });
}

async function fetchPublicKey() {
  const response = await fetch("/api/push/subscribe", { credentials: "same-origin" });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as { publicKey?: unknown } | null;
  return typeof payload?.publicKey === "string"
    ? urlBase64ToUint8Array(payload.publicKey)
    : null;
}
