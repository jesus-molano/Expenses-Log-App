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
} from "serwist";
import {
  OFFLINE_STATUS_REQUEST,
  OFFLINE_STATUS_RESPONSE,
  PRECACHE_FAILED_MESSAGE,
  PRECACHE_RETRY_DELAYS_MS,
  countCachedPrecacheKeys,
  describePrecacheUrl,
  isTransientStatus,
  type OfflineStatusResponse,
  type PrecacheFailedMessage,
} from "./cache-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/api/"),
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
      networkTimeoutSeconds: 3,
      plugins: [
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
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
];

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
    }
    return current;
  },
  fetchDidFail: async ({ event, request }) => {
    if (event?.type === "install") await reportPrecacheFailure(request.url, 0);
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 4,
    plugins: [precacheDiagnosticsPlugin],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
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

serwist.addEventListeners();

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
    return event.data?.json() as
      | { title?: string; body?: string; url?: string }
      | undefined;
  } catch {
    return undefined;
  }
}

self.addEventListener("push", (event) => {
  const data = readPushPayload(event);
  const title = data?.title ?? "Expense Reminders";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data?.body ?? "Tienes gastos por revisar.",
      icon: "/icon-192.png?v=5",
      badge: "/icon-192.png?v=5",
      data: { url: data?.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = String(event.notification.data?.url ?? "/");
  const parsedUrl = new URL(requestedUrl, self.location.origin);
  const targetUrl =
    parsedUrl.origin === self.location.origin
      ? parsedUrl.href
      : new URL("/", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const existingClient = windowClients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (existingClient) {
          await existingClient.navigate(targetUrl);
          return existingClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
