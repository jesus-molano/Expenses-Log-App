import type { OfflineDiagnostic } from "@/data/persistence/offline-diagnostic-store";

export type OfflineReadiness =
  | "unsupported"
  | "missing"
  | "legacy"
  | "unknown"
  | "failed"
  | "preparing"
  | "ready";

export type OfflineStatus = {
  expected: number;
  cached: number;
};

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
  // La caché del service worker escrito a mano anterior a Serwist identifica
  // la versión antigua, que sin conexión sirve el HTML pero no el JavaScript.
  if (hasLegacyCache) return "legacy";
  if (hasRegistration) return "unknown";
  return "missing";
}

// Un fallo de una instalación nueva no debe borrarse solo porque la versión
// activa (anterior) siga lista.
export function shouldClearOfflineDiagnostic({
  readiness,
  isInstalling,
}: {
  readiness: OfflineReadiness;
  isInstalling: boolean;
}) {
  return readiness === "ready" && !isInstalling;
}
