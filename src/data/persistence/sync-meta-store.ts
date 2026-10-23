// Estado de sincronización del store local, separado del propio store para que
// sobreviva a recargas y cierres: dice si hay cambios locales sin subir y de
// qué cuenta son.
export type SyncMeta = {
  ownerId: string | null;
  dirty: boolean;
  updatedAt: string;
};

export const SYNC_META_KEY = "expense-log-sync-v1";

const CLEAN_META: SyncMeta = { ownerId: null, dirty: false, updatedAt: "" };

export function readSyncMeta(
  storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage(),
): SyncMeta {
  try {
    const raw = storage?.getItem(SYNC_META_KEY);
    if (!raw) return CLEAN_META;
    const value = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      ownerId: typeof value.ownerId === "string" ? value.ownerId : null,
      dirty: value.dirty === true,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    };
  } catch {
    return CLEAN_META;
  }
}

export function writeSyncMeta(
  meta: Omit<SyncMeta, "updatedAt">,
  {
    now = new Date(),
    storage = safeLocalStorage(),
  }: { now?: Date; storage?: Pick<Storage, "setItem"> } = {},
) {
  try {
    storage?.setItem(
      SYNC_META_KEY,
      JSON.stringify({ ...meta, updatedAt: now.toISOString() }),
    );
  } catch {
    // Sin almacenamiento solo se pierde la recuperación de cambios offline.
  }
}

// Cambios locales de esta cuenta que aún no están en la nube.
export function hasUnsyncedChangesFor(meta: SyncMeta, userId: string) {
  return meta.dirty && meta.ownerId === userId;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
