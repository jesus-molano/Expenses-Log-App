export type OfflineReadiness =
  | "unsupported"
  | "missing"
  | "legacy"
  | "failed"
  | "preparing"
  | "ready";

export type OfflineStatus = {
  expected: number;
  cached: number;
};

export type OfflineDiagnostic = {
  at: string;
  url: string;
  status: number;
};

export const OFFLINE_DIAGNOSTIC_KEY = "offline-diag-v1";

export function resolveOfflineReadiness({
  supported,
  hasRegistration,
  isInstalling,
  status,
  hasLegacyCache,
  lastFailure,
}: {
  supported: boolean;
  hasRegistration: boolean;
  isInstalling: boolean;
  status: OfflineStatus | null;
  hasLegacyCache: boolean;
  lastFailure: OfflineDiagnostic | null;
}): OfflineReadiness {
  if (!supported) return "unsupported";
  if (status && status.expected > 0 && status.cached >= status.expected) {
    return "ready";
  }
  if (lastFailure) return "failed";
  if (isInstalling || status) return "preparing";
  // Hay un service worker activo que no responde al estado: es el anterior a
  // Serwist, que offline sirve el HTML pero no el JavaScript.
  if (hasRegistration || hasLegacyCache) return "legacy";
  return "missing";
}

export function parseOfflineDiagnostic(
  raw: string | null,
): OfflineDiagnostic | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OfflineDiagnostic>;
    return typeof value.at === "string" &&
      typeof value.url === "string" &&
      typeof value.status === "number"
      ? { at: value.at, url: value.url, status: value.status }
      : null;
  } catch {
    return null;
  }
}

export function readOfflineDiagnostic(
  storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage(),
): OfflineDiagnostic | null {
  try {
    return parseOfflineDiagnostic(storage?.getItem(OFFLINE_DIAGNOSTIC_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeOfflineDiagnostic(
  diagnostic: Omit<OfflineDiagnostic, "at">,
  now = new Date(),
  storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage(),
) {
  try {
    storage?.setItem(
      OFFLINE_DIAGNOSTIC_KEY,
      JSON.stringify({ ...diagnostic, at: now.toISOString() }),
    );
  } catch {
    // El diagnóstico es opcional; nunca debe romper la app.
  }
}

export function clearOfflineDiagnostic(
  storage: Pick<Storage, "removeItem"> | undefined = safeLocalStorage(),
) {
  try {
    storage?.removeItem(OFFLINE_DIAGNOSTIC_KEY);
  } catch {
    // Igual que al escribir: sin almacenamiento no hay diagnóstico.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
