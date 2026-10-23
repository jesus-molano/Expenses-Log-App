import type { CloudStoreSaveResult } from "@/data/persistence/cloud-store";
import type { ExpenseStore } from "@/domain/types";

export const CLOUD_SAVE_DEBOUNCE_MS = 350;

export type CloudSaveTarget = {
  userId: string;
  save: (store: ExpenseStore) => Promise<CloudStoreSaveResult>;
};

export type CloudSaveQueueDeps = {
  // null sin sesión o mientras la nube no está lista.
  resolveTarget: () => CloudSaveTarget | null;
  onSaving: (message?: string) => void;
  onSaved: (saved: {
    mode: CloudStoreSaveResult["mode"];
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
    onSaving(current.message);
    try {
      const result = await target.save(current.store);
      if (pending === current) pending = null;
      settleWaiters(true, current.revision);
      onSaved({
        mode: result.mode,
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

  function clear() {
    clearTimer();
    pending = null;
    settleWaiters(false);
  }

  return {
    enqueue,
    flush,
    saveNow,
    clear,
    hasPending: () => pending !== null,
  };
}

export type CloudSaveQueue = ReturnType<typeof createCloudSaveQueue>;
