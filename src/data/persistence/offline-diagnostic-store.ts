// Último fallo de instalación del service worker, para verlo en Ajustes.
export type OfflineDiagnostic = {
  at: string;
  url: string;
  status: number;
};

export const OFFLINE_DIAGNOSTIC_KEY = "offline-diag-v1";

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

// Un fallo sin URL (la instalación acabó descartada) no sustituye a uno con
// URL de la misma instalación: es menos informativo.
export function writeOfflineDiagnostic(
  diagnostic: Omit<OfflineDiagnostic, "at">,
  {
    now = new Date(),
    keepDetailedSince,
    storage = safeLocalStorage(),
  }: {
    now?: Date;
    keepDetailedSince?: Date;
    storage?: Pick<Storage, "getItem" | "setItem">;
  } = {},
) {
  try {
    if (!diagnostic.url && keepDetailedSince) {
      const previous = readOfflineDiagnostic(storage);
      if (
        previous?.url &&
        Date.parse(previous.at) >= keepDetailedSince.getTime()
      ) {
        return;
      }
    }
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
