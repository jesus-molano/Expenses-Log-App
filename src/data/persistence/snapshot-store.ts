import { hasUserData, summarizeStore } from "@/domain/store-summary";
import type { ExpenseStore } from "@/domain/types";
import {
  hashStoreContent,
  isStoreSnapshot,
  shouldTakeDailySnapshot,
  snapshotsToPrune,
  sortNewestFirst,
  type SnapshotReason,
  type StoreSnapshot,
} from "./snapshot-policy";

// Las copias van a IndexedDB y no a localStorage: varias copias del store
// llenarían el cupo de localStorage y entonces fallaría guardar el propio
// store. Sin IndexedDB (navegación privada en algunos navegadores) no hay
// copias, pero la app sigue igual.
export const SNAPSHOTS_UPDATED_EVENT = "expense-snapshots-updated";

const DB_NAME = "expense-log-backups";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
// Lo máximo que cerrar sesión espera a que se borren las copias.
const CLEAR_TIMEOUT_MS = 3_000;

export type SnapshotBackend = {
  getAll(): Promise<unknown[]>;
  put(snapshot: StoreSnapshot): Promise<void>;
  remove(ids: string[]): Promise<void>;
  clear(): Promise<void>;
};

export type SnapshotRepository = ReturnType<typeof createSnapshotRepository>;

export function createSnapshotRepository(
  backend: SnapshotBackend,
  { onChange }: { onChange?: () => void } = {},
) {
  async function list(): Promise<StoreSnapshot[]> {
    return sortNewestFirst((await backend.getAll()).filter(isStoreSnapshot));
  }

  async function save(
    store: ExpenseStore,
    reason: SnapshotReason,
    now = new Date(),
  ): Promise<StoreSnapshot | null> {
    if (!hasUserData(store)) return null;
    const snapshot: StoreSnapshot = {
      id: `snapshot-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now.toISOString(),
      reason,
      hash: hashStoreContent(store),
      summary: summarizeStore(store),
      store,
    };
    await backend.put(snapshot);
    const stale = snapshotsToPrune(await list());
    if (stale.length) await backend.remove(stale);
    onChange?.();
    return snapshot;
  }

  // Volver a la app y el temporizador del arranque pueden coincidir: la
  // segunda llamada espera a la primera en lugar de guardar otra diaria.
  let dailyInFlight: Promise<StoreSnapshot | null> | null = null;

  function saveDaily(store: ExpenseStore, now = new Date()) {
    dailyInFlight ??= (async () => {
      if (!hasUserData(store)) return null;
      const snapshots = await list();
      if (!shouldTakeDailySnapshot(snapshots, { now, hash: hashStoreContent(store) })) {
        return null;
      }
      return save(store, "daily", now);
    })().finally(() => {
      dailyInFlight = null;
    });
    return dailyInFlight;
  }

  // Borra todas las copias de este dispositivo. Una diaria a medias termina
  // antes: si no, podría guardarse justo después del borrado.
  async function clear() {
    await dailyInFlight?.catch(() => null);
    await backend.clear();
    onChange?.();
  }

  return { list, save, saveDaily, clear };
}

let repository: SnapshotRepository | null | undefined;

// Borra las copias de este dispositivo (cerrar sesión borrando los datos,
// eliminar la cuenta): guardan el store entero y el siguiente que use el
// navegador podría restaurarlas. Si IndexedDB no responde, no bloquea la
// salida más de CLEAR_TIMEOUT_MS.
export async function clearSnapshots(): Promise<void> {
  const repository = getSnapshotRepository();
  if (!repository) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      repository.clear(),
      new Promise<void>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Clearing snapshots timed out")), CLEAR_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error("Could not clear snapshots", error);
  } finally {
    clearTimeout(timer);
  }
}

// Repositorio sobre IndexedDB, o null si el navegador no lo ofrece.
export function getSnapshotRepository(): SnapshotRepository | null {
  if (repository !== undefined) return repository;
  const backend = createIndexedDbBackend();
  repository = backend
    ? createSnapshotRepository(backend, {
        onChange: () => window.dispatchEvent(new Event(SNAPSHOTS_UPDATED_EVENT)),
      })
    : null;
  return repository;
}

function createIndexedDbBackend(): SnapshotBackend | null {
  if (typeof window === "undefined" || !("indexedDB" in window) || !window.indexedDB) {
    return null;
  }
  let database: Promise<IDBDatabase> | null = null;

  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB blocked"));
    }).catch((error: unknown) => {
      // Un fallo al abrir no se queda cacheado: se reintenta la próxima vez.
      database = null;
      throw error;
    });
    return database;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> {
    const db = await open();
    return new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  return {
    async getAll() {
      return (await run<unknown[]>("readonly", (store) => store.getAll())) ?? [];
    },
    async put(snapshot) {
      await run("readwrite", (store) => store.put(snapshot));
    },
    async remove(ids) {
      await run("readwrite", (store) => {
        ids.forEach((id) => store.delete(id));
      });
    },
    // Vacía el almacén en lugar de borrar la base: deleteDatabase se quedaría
    // bloqueado por la conexión abierta de esta pestaña o de otra.
    async clear() {
      await run("readwrite", (store) => store.clear());
    },
  };
}
