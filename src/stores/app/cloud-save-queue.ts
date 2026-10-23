import type { CloudStoreSaveResult } from "@/data/persistence/cloud-store";
import type { ExpenseStore } from "@/domain/types";

export const CLOUD_SAVE_DEBOUNCE_MS = 350;

// Reintentos tras un conflicto (otro dispositivo guardó antes). Si la nube
// sigue cambiando, se deja para la siguiente sincronización.
export const MAX_CONFLICT_RETRIES = 3;

type SaveMode = Extract<CloudStoreSaveResult, { status: "saved" }>["mode"];

export class CloudSaveConflictError extends Error {
  constructor() {
    super("The cloud store kept changing while saving.");
    this.name = "CloudSaveConflictError";
  }
}

export type ConflictAwareSave = {
  save: (store: ExpenseStore) => Promise<CloudStoreSaveResult>;
  // Trae la nube, la fusiona con lo último del dispositivo, lo hidrata y
  // devuelve la versión a subir.
  resolveConflict: (store: ExpenseStore) => Promise<ExpenseStore>;
};

// Guarda con compare-and-swap: ante un conflicto fusiona con la nube y vuelve
// a intentarlo con la fusión. `onResolved` recibe cada fusión para que quien
// tenga copias pendientes las sustituya (ya están incluidas en ella).
export async function saveResolvingConflicts(
  store: ExpenseStore,
  {
    save,
    resolveConflict,
    onResolved,
    maxRetries = MAX_CONFLICT_RETRIES,
  }: ConflictAwareSave & {
    onResolved?: (merged: ExpenseStore) => void;
    maxRetries?: number;
  },
): Promise<{ mode: SaveMode; store: ExpenseStore }> {
  let attempt = store;
  for (let retry = 0; ; retry += 1) {
    const result = await save(attempt);
    if (result.status === "saved") return { mode: result.mode, store: attempt };
    if (retry >= maxRetries) throw new CloudSaveConflictError();
    attempt = await resolveConflict(attempt);
    onResolved?.(attempt);
  }
}

export type CloudSaveTarget = ConflictAwareSave & {
  userId: string;
};

export type CloudSaveQueueDeps = {
  // null sin sesión o mientras la nube no está lista.
  resolveTarget: () => CloudSaveTarget | null;
  onSaving: (message?: string) => void;
  onSaved: (saved: {
    mode: SaveMode;
    revision: number;
    userId: string;
    hasNewerChanges: boolean;
  }) => void;
  // Tras un fallo la cola no reintenta subiendo la misma copia: la nube puede
  // haber cambiado mientras tanto. Quien la usa vuelve a sincronizar
  // fusionando (los cambios siguen marcados como pendientes).
  onFailed: (error: unknown) => void;
  debounceMs?: number;
};

type PendingSave = { store: ExpenseStore; revision: number; message?: string };
type Waiter = { revision: number; resolve: (saved: boolean) => void };

// Guarda en la nube siempre la última versión del store, de una en una para
// que una respuesta lenta no pise otra más nueva.
export function createCloudSaveQueue({
  resolveTarget,
  onSaving,
  onSaved,
  onFailed,
  debounceMs = CLOUD_SAVE_DEBOUNCE_MS,
}: CloudSaveQueueDeps) {
  let pending: PendingSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let inFlight: PendingSave | null = null;
  let waiters: Waiter[] = [];

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function settleWaiters(saved: boolean, upToRevision = Infinity) {
    const settled = waiters.filter((waiter) => waiter.revision <= upToRevision);
    waiters = waiters.filter((waiter) => waiter.revision > upToRevision);
    settled.forEach((waiter) => waiter.resolve(saved));
  }

  function enqueue(store: ExpenseStore, revision: number, message?: string) {
    if (!resolveTarget()) return;
    pending = { store, revision, message };
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (running || !pending) return;
    const target = resolveTarget();
    if (!target) {
      // Sin sesión o con la nube recargando, esa versión ya no debe subirse:
      // la siguiente sincronización fusiona los cambios pendientes.
      clear();
      return;
    }

    const current = pending;
    running = true;
    inFlight = current;
    onSaving(current.message);
    try {
      const { mode } = await saveResolvingConflicts(current.store, {
        save: target.save,
        resolveConflict: target.resolveConflict,
        // Lo encolado durante la subida no lleva lo que trajo la nube.
        onResolved: rebase,
      });
      if (pending === current) pending = null;
      settleWaiters(true, current.revision);
      onSaved({
        mode,
        revision: current.revision,
        userId: target.userId,
        hasNewerChanges: pending !== null,
      });
    } catch (error) {
      pending = null;
      settleWaiters(false);
      onFailed(error);
    } finally {
      running = false;
      inFlight = null;
    }

    if (pending && pending !== current) await flush();
  }

  // Sube ya esta versión y espera a que llegue a la nube (true) o falle o se
  // descarte (false). Si hay otro guardado en curso, esta va justo después.
  function saveNow(store: ExpenseStore, revision: number, message?: string) {
    if (!resolveTarget()) return Promise.resolve(false);
    const saved = new Promise<boolean>((resolve) => {
      waiters.push({ revision, resolve });
    });
    pending = { store, revision, message };
    void flush();
    return saved;
  }

  // Sustituye la copia pendiente por una que ya la incluye (una fusión con la
  // nube o con otra pestaña), sin cambiar su revisión local. La que está
  // subiendo no se toca: si se fusionó, ella misma sube la fusión.
  function rebase(store: ExpenseStore) {
    if (pending && pending !== inFlight) pending = { ...pending, store };
  }

  function clear() {
    clearTimer();
    pending = null;
    settleWaiters(false);
  }

  return {
    enqueue,
    flush,
    saveNow,
    rebase,
    clear,
    hasPending: () => pending !== null,
    isIdle: () => !running && pending === null,
  };
}

export type CloudSaveQueue = ReturnType<typeof createCloudSaveQueue>;
