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

// Relación de los datos locales con la cuenta que entra:
// - `foreign`: son de otra cuenta y no deben fusionarse ni subirse a esta;
// - `dirty`: tienen cambios sin subir que hay que fusionar. Los cambios sin
//   cuenta (uso sin sesión, o sin red antes de resolverla) son de la primera
//   que entra.
// `storeOwnerId` es el dueño que dicen los propios datos
// (`inferStoreOwnerId`): cubre los dispositivos que sincronizaron antes de
// existir estos metadatos y no tienen `ownerId`.
export function localChangesFor(
  meta: SyncMeta,
  userId: string,
  storeOwnerId: string | null = null,
) {
  const ownerId = meta.ownerId ?? storeOwnerId;
  const foreign = ownerId !== null && ownerId !== userId;
  return { foreign, dirty: meta.dirty && !foreign };
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
