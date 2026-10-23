import type { CloudStoreSaveResult } from "@/data/persistence/cloud-store";
import type { ExpenseStore } from "@/domain/types";

export const CLOUD_SAVE_DEBOUNCE_MS = 350;

// Tras agotar los reintentos se espera a recuperar la conexión, a volver a la
// app o a un cambio nuevo. Los cambios siguen marcados como pendientes en el
// dispositivo, así que no se pierden aunque se cierre la app.
export const CLOUD_SAVE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export type CloudSaveTarget = {
  userId: string;
  save: (store: ExpenseStore) => Promise<CloudStoreSaveResult>;
};

export type CloudSaveQueueDeps = {
  // null sin sesión o mientras la nube no está lista.
  resolveTarget: () => CloudSaveTarget | null;
  onSaving: () => void;
  onSaved: (saved: {
    mode: CloudStoreSaveResult["mode"];
    revision: number;
    userId: string;
    hasNewerChanges: boolean;
  }) => void;
  onFailed: (error: unknown, failure: { willRetry: boolean }) => void;
  debounceMs?: number;
  retryDelaysMs?: readonly number[];
};

type PendingSave = { store: ExpenseStore; revision: number };

// Guarda en la nube siempre la última versión del store, de una en una para
// que una respuesta lenta no pise otra más nueva.
export function createCloudSaveQueue({
  resolveTarget,
  onSaving,
  onSaved,
  onFailed,
  debounceMs = CLOUD_SAVE_DEBOUNCE_MS,
  retryDelaysMs = CLOUD_SAVE_RETRY_DELAYS_MS,
}: CloudSaveQueueDeps) {
  let pending: PendingSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let attempt = 0;

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function schedule(delayMs: number) {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  function enqueue(store: ExpenseStore, revision: number) {
    if (!resolveTarget()) return;
    pending = { store, revision };
    attempt = 0;
    schedule(debounceMs);
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (running || !pending) return;
    const target = resolveTarget();
    if (!target) {
      // Sin sesión o con la nube recargando, esa versión ya no debe subirse:
      // la siguiente sincronización fusiona los cambios pendientes.
      pending = null;
      attempt = 0;
      return;
    }

    const current = pending;
    running = true;
    onSaving();
    try {
      const result = await target.save(current.store);
      if (pending === current) {
        pending = null;
        attempt = 0;
      }
      onSaved({
        mode: result.mode,
        revision: current.revision,
        userId: target.userId,
        hasNewerChanges: pending !== null,
      });
    } catch (error) {
      if (pending === current) {
        const delay = retryDelaysMs[attempt];
        attempt += 1;
        if (delay !== undefined) schedule(delay);
        onFailed(error, { willRetry: delay !== undefined });
      }
    } finally {
      running = false;
    }

    if (pending && pending !== current) await flush();
  }

  // Al recuperar la conexión o volver a la app: reintento inmediato y, si
  // vuelve a fallar, otra ronda completa de reintentos.
  function retryNow() {
    if (!pending) return;
    attempt = 0;
    void flush();
  }

  function clear() {
    clearTimer();
    pending = null;
    attempt = 0;
  }

  return {
    enqueue,
    flush,
    retryNow,
    clear,
    hasPending: () => pending !== null,
  };
}

export type CloudSaveQueue = ReturnType<typeof createCloudSaveQueue>;
