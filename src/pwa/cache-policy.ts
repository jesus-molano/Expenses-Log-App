// Contrato y reglas puras compartidas por el service worker y la app.

export const OFFLINE_STATUS_REQUEST = "GET_OFFLINE_STATUS";
export const OFFLINE_STATUS_RESPONSE = "OFFLINE_STATUS";
export const PRECACHE_FAILED_MESSAGE = "PRECACHE_FAILED";

// Prefijo de la caché del service worker escrito a mano anterior a Serwist.
export const LEGACY_CACHE_PREFIX = "expense-reminders-";

// Esperas antes de cada reintento de una URL del precache con error temporal.
export const PRECACHE_RETRY_DELAYS_MS = [1_000, 3_000] as const;

export type OfflineStatusResponse = {
  type: typeof OFFLINE_STATUS_RESPONSE;
  expected: number;
  cached: number;
};

export type PrecacheFailedMessage = {
  type: typeof PRECACHE_FAILED_MESSAGE;
  url: string;
  status: number;
};

export function isTransientStatus(status: number) {
  return status === 429 || status >= 500;
}

export function isLegacyCacheName(cacheName: string) {
  return cacheName.startsWith(LEGACY_CACHE_PREFIX);
}

// Ruta legible de una petición de precache, sin origen ni revisión de Serwist.
export function describePrecacheUrl(href: string) {
  const url = new URL(href, "https://app.invalid");
  url.searchParams.delete("__WB_REVISION__");
  return `${url.pathname}${url.search}`;
}

export function countCachedPrecacheKeys(
  expectedKeys: Iterable<string>,
  cachedUrls: Iterable<string>,
) {
  const cached = new Set(cachedUrls);
  let count = 0;
  for (const key of new Set(expectedKeys)) {
    if (cached.has(key)) count += 1;
  }
  return count;
}

export function isOfflineStatusResponse(
  value: unknown,
): value is OfflineStatusResponse {
  return (
    isRecord(value) &&
    value.type === OFFLINE_STATUS_RESPONSE &&
    typeof value.expected === "number" &&
    typeof value.cached === "number"
  );
}

export function isPrecacheFailedMessage(
  value: unknown,
): value is PrecacheFailedMessage {
  return (
    isRecord(value) &&
    value.type === PRECACHE_FAILED_MESSAGE &&
    typeof value.url === "string" &&
    typeof value.status === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
