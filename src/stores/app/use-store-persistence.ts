"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import {
  EXPENSE_STORE_KEY,
  loadExpenseStore,
  markExpenseStoreSeen,
  readExpenseStoreFromOtherTab,
  saveExpenseStore,
} from "@/data/persistence/local-store";
import { assignExpenseStoreOwner } from "@/data/persistence/store-normalization";
import {
  localChangesFor,
  readSyncMeta,
  writeSyncMeta,
} from "@/data/persistence/sync-meta-store";
import { t } from "@/shared/i18n";
import { createClient } from "@/utils/supabase/client";
import { saveResolvingConflicts } from "./cloud-save-queue";
import { applyRuntimePreferences } from "./runtime-preferences";
import {
  isTransientSyncError,
  mergeStoreFromOtherTab,
  mergeStoresForSync,
  resolveHydratedStore,
  shouldPullCloud,
  storesEquivalent,
} from "./sync-policy";
import { useCloudSaveQueue } from "./use-cloud-save-queue";
import { useSyncState } from "./use-sync-state";

type UseStorePersistenceOptions = {
  onHydrate: (store: ExpenseStore) => void;
};

// Tras un fallo se vuelve a sincronizar (cargar, fusionar y subir) con estas
// esperas; después, al recuperar la red, volver a la app o navegar.
export const RESYNC_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export function useStorePersistence({ onHydrate }: UseStorePersistenceOptions) {
  const [isHydrated, setIsHydrated] = useState(false);
  const pathname = usePathname();
  const supabaseRef = useRef<AppSupabaseClient | null>(null);
  const userRef = useRef<User | null>(null);
  const activeRef = useRef(false);
  const hydratedRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const localRevisionRef = useRef(0);
  const refreshAuthRef = useRef<() => void>(() => {});
  const syncedUserIdRef = useRef<string | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);
  const syncRunRef = useRef(0);
  const resyncAttemptRef = useRef(0);
  const resyncTimerRef = useRef<number | null>(null);
  // Lo que muestra la app: las fusiones con la nube o con otra pestaña parten
  // de aquí para no perder ediciones que aún no han subido.
  const latestStoreRef = useRef<ExpenseStore | null>(null);
  // Cuenta a la que pertenecen los datos en memoria (null: sin cuenta).
  const dataOwnerRef = useRef<string | null>(null);
  // Revisión de la nube sobre la que se guarda (CAS); null: sin fila conocida.
  const cloudRevisionRef = useRef<number | null>(null);
  // Última carga o guardado correcto, para no traer la nube en cada vuelta.
  const lastCloudContactRef = useRef(0);
  const {
    syncStatus,
    syncMessage,
    markLocal,
    markSyncing,
    markSynced,
    markSaved,
    markPending,
    markError,
  } = useSyncState();

  const hydrateStore = useCallback(
    (store: ExpenseStore) => {
      latestStoreRef.current = store;
      onHydrate(store);
    },
    [onHydrate],
  );

  // Los datos de otra pestaña solo se incorporan si son de la misma cuenta
  // que los de esta (o alguna de las dos aún no tiene cuenta).
  const sharesDataOwner = useCallback(() => {
    const otherOwner = readSyncMeta().ownerId;
    const owner = userRef.current?.id ?? dataOwnerRef.current;
    return !owner || !otherOwner || owner === otherOwner;
  }, []);

  // Escribe en el dispositivo incorporando lo que otra pestaña guardó desde
  // la última escritura de esta: dos pestañas no se pisan los cambios.
  const writeLocalStore = useCallback(
    (store: ExpenseStore) => {
      const other = readExpenseStoreFromOtherTab();
      const next =
        other && sharesDataOwner()
          ? assignExpenseStoreOwner(
              mergeStoresForSync(store, other.store),
              userRef.current?.id,
            )
          : store;
      saveExpenseStore(next);
      return next;
    },
    [sharesDataOwner],
  );

  // Solo se da por subido si llegó a la tabla y nadie ha editado desde que
  // salió esa versión.
  const markCloudSaved = useCallback(
    (revision: number, userId: string, mode: "table" | "unavailable") => {
      if (mode !== "table" || revision !== localRevisionRef.current) return;
      writeSyncMeta({ ownerId: userId, dirty: false });
    },
    [],
  );

  // Guarda con compare-and-swap sobre la última revisión conocida.
  const saveStoreToCloud = useCallback(
    async (supabase: AppSupabaseClient, user: User, store: ExpenseStore) => {
      const result = await saveCloudStore(supabase, user, store, cloudRevisionRef.current);
      if (result.status === "saved") {
        cloudRevisionRef.current = result.revision;
        lastCloudContactRef.current = Date.now();
      }
      return result;
    },
    [],
  );

  // Otro dispositivo guardó antes: se trae la nube, se fusiona con lo que
  // muestra la app, se hidrata y se devuelve la versión a subir.
  const resolveCloudConflict = useCallback(
    async (supabase: AppSupabaseClient, user: User, attempt: ExpenseStore) => {
      const cloud = await loadCloudStore(supabase, user);
      if (!activeRef.current || userRef.current?.id !== user.id) {
        throw new Error(t("settings.cloudSyncError"));
      }
      cloudRevisionRef.current = cloud.revision;
      lastCloudContactRef.current = Date.now();

      const current = latestStoreRef.current ?? attempt;
      const merged = assignExpenseStoreOwner(
        mergeStoresForSync(current, cloud.store),
        user.id,
      );
      if (storesEquivalent(merged, current)) return current;
      const written = writeLocalStore(merged);
      hydrateStore(written);
      return written;
    },
    [hydrateStore, writeLocalStore],
  );

  const cancelResync = useCallback(() => {
    if (resyncTimerRef.current !== null) window.clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = null;
  }, []);
  const scheduleResync = useCallback(() => {
    if (resyncTimerRef.current !== null) return;
    const delay = RESYNC_DELAYS_MS[resyncAttemptRef.current];
    if (delay === undefined) return;
    resyncAttemptRef.current += 1;
    resyncTimerRef.current = window.setTimeout(() => {
      resyncTimerRef.current = null;
      refreshAuthRef.current();
    }, delay);
  }, []);
  const reportSyncFailure = useCallback(
    (error: unknown, fallbackKey: "settings.cloudSaveError" | "settings.cloudSyncError") => {
      const transient = !navigator.onLine || isTransientSyncError(error);
      if (transient && readSyncMeta().dirty) {
        markPending();
      } else {
        markError(error, fallbackKey);
      }
      if (transient) scheduleResync();
    },
    [markError, markPending, scheduleResync],
  );
  // Un guardado que falla no se repite con la misma copia: la nube puede haber
  // cambiado. Se vuelve a sincronizar, que fusiona los cambios pendientes.
  const handleCloudSaveFailed = useCallback(
    (error: unknown) => {
      cloudReadyRef.current = false;
      // Tras cerrar sesión ya no hay nube que sincronizar.
      if (!userRef.current) return;
      reportSyncFailure(error, "settings.cloudSaveError");
    },
    [reportSyncFailure],
  );
  const {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
    flushQueuedSave,
    rebaseQueuedSave,
    isQueueIdle,
  } = useCloudSaveQueue({
    supabaseRef,
    userRef,
    cloudReadyRef,
    saveToCloud: saveStoreToCloud,
    resolveConflict: resolveCloudConflict,
    markSyncing,
    markSaved,
    onCloudSaved: markCloudSaved,
    onCloudSaveFailed: handleCloudSaveFailed,
  });

  useEffect(() => {
    let active = true;
    activeRef.current = true;
    // Primero los datos locales: la app debe abrirse aunque falle Supabase.
    hydrateLocalSnapshot();
    const supabase = createSupabaseClient();
    supabaseRef.current = supabase;

    function hydrateLocalSnapshot() {
      try {
        const localStore = applyRuntimePreferences(loadExpenseStore());
        dataOwnerRef.current = readSyncMeta().ownerId;
        saveExpenseStore(localStore);
        if (active) hydrateStore(localStore);
      } finally {
        markHydrated();
      }
    }

    function createSupabaseClient() {
      try {
        return createClient();
      } catch (error) {
        markError(error, "settings.cloudSyncError");
        return null;
      }
    }

    function markHydrated() {
      hydratedRef.current = true;
      setIsHydrated(true);
    }

    function markUnauthenticated() {
      syncRunRef.current += 1;
      syncedUserIdRef.current = null;
      syncingUserIdRef.current = null;
      userRef.current = null;
      cloudReadyRef.current = false;
      cloudRevisionRef.current = null;
      markHydrated();
      markLocal();
      clearQueuedSave();
    }

    async function syncAuthenticatedUser(user: User | null) {
      if (!supabase) {
        markUnauthenticated();
        return;
      }

      if (!active || !user) {
        markUnauthenticated();
        return;
      }

      if (
        syncingUserIdRef.current === user.id ||
        (syncedUserIdRef.current === user.id && cloudReadyRef.current)
      ) {
        return;
      }

      const revisionBeforeCloudHydration = localRevisionRef.current;
      const initialLocalStore = applyRuntimePreferences(loadExpenseStore());
      const localChanges = localChangesFor(readSyncMeta(), user.id);
      const syncRun = syncRunRef.current + 1;
      syncRunRef.current = syncRun;
      syncingUserIdRef.current = user.id;
      userRef.current = user;
      cloudReadyRef.current = false;
      clearQueuedSave();
      markSyncing(t("settings.preparingCloud"));

      try {
        const cloud = await loadCloudStore(supabase, user);
        if (!active || syncRunRef.current !== syncRun) return;
        cloudRevisionRef.current = cloud.revision;
        lastCloudContactRef.current = Date.now();

        const latestLocalStore = applyRuntimePreferences(loadExpenseStore());
        const { mergedStore, shouldSaveCloud } = resolveHydratedStore({
          initialLocalStore,
          latestLocalStore,
          cloudStore: cloud.store,
          revisionAtCloudLoad: revisionBeforeCloudHydration,
          currentRevision: localRevisionRef.current,
          localDirty: localChanges.dirty,
          localIsForeign: localChanges.foreign,
        });
        const ownedStore = assignExpenseStoreOwner(mergedStore, user.id);
        // La fusión incluye las ediciones hechas mientras cargaba la nube:
        // sin hidratarla, el siguiente guardado subiría el estado sin lo que
        // solo estaba en la nube.
        saveExpenseStore(ownedStore);
        dataOwnerRef.current = user.id;
        if (active) hydrateStore(ownedStore);
        markHydrated();
        syncedUserIdRef.current = user.id;
        // syncingUserIdRef sigue puesto hasta subir la fusión: volver a la
        // app o navegar no debe lanzar otra sincronización a la vez.

        if (shouldSaveCloud) {
          const revisionAtSave = localRevisionRef.current;
          const saved = await saveResolvingConflicts(ownedStore, {
            save: (store) => saveStoreToCloud(supabase, user, store),
            resolveConflict: (store) => resolveCloudConflict(supabase, user, store),
          });
          if (!active || syncRunRef.current !== syncRun) return;
          syncingUserIdRef.current = null;
          cloudReadyRef.current = saved.mode === "table";
          resyncAttemptRef.current = 0;
          markCloudSaved(revisionAtSave, user.id, saved.mode);
          markSynced(saved.mode);
          // Lo editado mientras subía la fusión no pudo encolarse aún.
          if (localRevisionRef.current !== revisionAtSave) {
            queueCloudSave(
              assignExpenseStoreOwner(
                latestStoreRef.current ?? loadExpenseStore(),
                user.id,
              ),
              localRevisionRef.current,
            );
          }
          return;
        }

        // Sin subida: o la nube ganó (nada pendiente) o los datos locales
        // eran de otra cuenta y se han sustituido.
        syncingUserIdRef.current = null;
        writeSyncMeta({ ownerId: user.id, dirty: false });
        cloudReadyRef.current = cloud.mode === "table";
        resyncAttemptRef.current = 0;
        markSynced(cloud.mode);
      } catch (error) {
        // Una sincronización ya sustituida por otra no toca su estado.
        if (!active || syncRunRef.current !== syncRun) return;
        syncingUserIdRef.current = null;
        cloudReadyRef.current = false;
        markHydrated();
        reportSyncFailure(error, "settings.cloudSyncError");
      }
    }

    // Trae lo que otros dispositivos subieron mientras la app estaba en
    // segundo plano. Sin cambios locales gana la nube; con ellos se fusiona y
    // se sube el resultado.
    async function pullCloudChanges() {
      const user = userRef.current;
      if (
        !supabase ||
        !user ||
        syncingUserIdRef.current ||
        !shouldPullCloud({
          cloudReady: cloudReadyRef.current,
          busy: !isQueueIdle(),
          lastCloudContactAt: lastCloudContactRef.current,
          now: Date.now(),
        })
      ) {
        return;
      }

      const syncRun = syncRunRef.current;
      const revisionAtLoad = localRevisionRef.current;
      lastCloudContactRef.current = Date.now();
      try {
        const cloud = await loadCloudStore(supabase, user);
        if (
          !active ||
          syncRunRef.current !== syncRun ||
          userRef.current?.id !== user.id ||
          !cloudReadyRef.current ||
          cloud.mode !== "table"
        ) {
          return;
        }
        // La misma revisión que la última guardada o cargada: nada nuevo.
        if (cloud.revision !== null && cloud.revision === cloudRevisionRef.current) return;

        const current = latestStoreRef.current ?? applyRuntimePreferences(loadExpenseStore());
        const { mergedStore, shouldSaveCloud } = resolveHydratedStore({
          initialLocalStore: current,
          latestLocalStore: current,
          cloudStore: cloud.store,
          revisionAtCloudLoad: revisionAtLoad,
          currentRevision: localRevisionRef.current,
          localDirty: localChangesFor(readSyncMeta(), user.id).dirty,
        });
        cloudRevisionRef.current = cloud.revision;
        const ownedStore = assignExpenseStoreOwner(mergedStore, user.id);
        let nextStore = current;
        if (!storesEquivalent(ownedStore, current)) {
          nextStore = writeLocalStore(ownedStore);
          hydrateStore(nextStore);
          if (!shouldSaveCloud) markSynced("table", t("sync.remoteChangesApplied"));
        }
        if (shouldSaveCloud) queueCloudSave(nextStore, localRevisionRef.current);
      } catch {
        // Un pull fallido no cambia nada: el siguiente guardado (con CAS) o la
        // próxima vuelta a la app lo intentan de nuevo.
      }
    }

    // Otra pestaña guardó en el dispositivo: se incorpora a lo que muestra
    // esta, sin volver a escribirlo (su siguiente guardado ya lo lleva).
    function adoptOtherTabChanges() {
      const current = latestStoreRef.current;
      const other = readExpenseStoreFromOtherTab();
      if (!current || !other) return;
      if (!sharesDataOwner()) {
        // La otra pestaña entró con otra cuenta: esta vuelve a sincronizar.
        refreshAuthRef.current();
        return;
      }
      markExpenseStoreSeen(other.raw);
      const merged = assignExpenseStoreOwner(
        mergeStoreFromOtherTab(current, other.store),
        userRef.current?.id,
      );
      if (storesEquivalent(merged, current)) return;
      // Un guardado en curso de esta pestaña no lleva esos cambios: no debe
      // darlos por subidos.
      localRevisionRef.current += 1;
      rebaseQueuedSave(merged);
      hydrateStore(merged);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === EXPENSE_STORE_KEY) adoptOtherTabChanges();
    }

    refreshAuthRef.current = () => {
      if (!supabase) {
        markUnauthenticated();
        return;
      }

      void supabase.auth
        .getUser()
        .then(({ data, error }) => {
          // Sin red la sesión sigue siendo válida: no es un cierre de sesión.
          if (!data.user && isAuthRetryableFetchError(error)) {
            if (!cloudReadyRef.current) scheduleResync();
            return;
          }
          return syncAuthenticatedUser(data.user ?? null);
        })
        .catch((error: unknown) => {
          cloudReadyRef.current = false;
          markError(error, "settings.cloudSyncError");
        });
    };

    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((event, session) => {
      // Sin red, auth-js emite la sesión inicial vacía aunque siga abierta:
      // getUser distingue un fallo de red de un cierre de sesión real.
      if (event === "INITIAL_SESSION" && !session) {
        refreshAuthRef.current();
        return;
      }
      void syncAuthenticatedUser(session?.user ?? null);
    }) ?? { data: { subscription: null } };

    const frame = window.requestAnimationFrame(() => refreshAuthRef.current());

    // Al recuperar la red o volver a la app se incorpora lo de otras
    // pestañas, se sube lo pendiente y se trae lo de otros dispositivos; si
    // la nube no está lista (no cargó o falló un guardado), se vuelve a
    // sincronizar, con una ronda nueva de reintentos.
    function resumeSync() {
      adoptOtherTabChanges();
      void flushQueuedSave();
      if (cloudReadyRef.current) {
        void pullCloudChanges();
        return;
      }
      cancelResync();
      resyncAttemptRef.current = 0;
      refreshAuthRef.current();
    }

    // Al salir de la app se sube ya lo que esperaba al debounce.
    function flushBeforeLeaving() {
      void flushQueuedSave();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushBeforeLeaving();
      } else {
        resumeSync();
      }
    }

    window.addEventListener("online", resumeSync);
    window.addEventListener("pagehide", flushBeforeLeaving);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      activeRef.current = false;
      window.cancelAnimationFrame(frame);
      subscription?.unsubscribe();
      window.removeEventListener("online", resumeSync);
      window.removeEventListener("pagehide", flushBeforeLeaving);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelResync();
      clearQueuedSave();
    };
  }, [
    cancelResync,
    clearQueuedSave,
    flushQueuedSave,
    hydrateStore,
    isQueueIdle,
    markCloudSaved,
    markError,
    markLocal,
    markSynced,
    markSyncing,
    queueCloudSave,
    rebaseQueuedSave,
    reportSyncFailure,
    resolveCloudConflict,
    saveStoreToCloud,
    scheduleResync,
    sharesDataOwner,
    writeLocalStore,
  ]);

  useEffect(() => {
    refreshAuthRef.current();
  }, [pathname]);

  // Guarda en el dispositivo y lo marca pendiente de subir antes de intentar
  // la nube: si la app se cierra o no hay red, la siguiente sincronización
  // fusiona estos cambios en lugar de descartarlos.
  function saveLocally(nextStore: ExpenseStore) {
    const ownedStore = writeLocalStore(
      assignExpenseStoreOwner(nextStore, userRef.current?.id),
    );
    latestStoreRef.current = ownedStore;
    localRevisionRef.current += 1;
    writeSyncMeta({
      ownerId: userRef.current?.id ?? readSyncMeta().ownerId,
      dirty: true,
    });
    return { ownedStore, revision: localRevisionRef.current };
  }

  function persist(nextStore: ExpenseStore, onPersist: (store: ExpenseStore) => void) {
    const { ownedStore, revision } = saveLocally(nextStore);
    onPersist(ownedStore);
    queueCloudSave(ownedStore, revision);
  }

  async function persistImmediately(
    nextStore: ExpenseStore,
    onPersist: (store: ExpenseStore) => void,
    syncingMessage: string,
  ) {
    const { ownedStore, revision } = saveLocally(nextStore);
    onPersist(ownedStore);
    await saveImmediately(ownedStore, revision, syncingMessage);
  }

  return {
    persist,
    persistImmediately,
    syncStatus,
    syncMessage,
    isHydrated,
  };
}
