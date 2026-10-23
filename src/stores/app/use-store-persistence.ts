"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import {
  loadExpenseStore,
  saveExpenseStore,
} from "@/data/persistence/local-store";
import { assignExpenseStoreOwner } from "@/data/persistence/store-normalization";
import {
  hasUnsyncedChangesFor,
  readSyncMeta,
  writeSyncMeta,
} from "@/data/persistence/sync-meta-store";
import { t } from "@/shared/i18n";
import { createClient } from "@/utils/supabase/client";
import { applyRuntimePreferences } from "./runtime-preferences";
import { resolveHydratedStore } from "./sync-policy";
import { useCloudSaveQueue } from "./use-cloud-save-queue";
import { useSyncState } from "./use-sync-state";

type UseStorePersistenceOptions = {
  onHydrate: (store: ExpenseStore) => void;
};

export function useStorePersistence({ onHydrate }: UseStorePersistenceOptions) {
  const [isHydrated, setIsHydrated] = useState(false);
  const pathname = usePathname();
  const supabaseRef = useRef<AppSupabaseClient | null>(null);
  const userRef = useRef<User | null>(null);
  const hydratedRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const localRevisionRef = useRef(0);
  const refreshAuthRef = useRef<() => void>(() => {});
  const syncedUserIdRef = useRef<string | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);
  const syncRunRef = useRef(0);
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
  // Solo se da por subido si nadie ha editado desde que salió esa versión.
  const markCloudSaved = useCallback((revision: number, userId: string) => {
    if (revision !== localRevisionRef.current) return;
    writeSyncMeta({ ownerId: userId, dirty: false });
  }, []);
  const {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
    flushQueuedSave,
    retryQueuedSave,
  } = useCloudSaveQueue({
    supabaseRef,
    userRef,
    cloudReadyRef,
    markSyncing,
    markSaved,
    markPending,
    markError,
    onCloudSaved: markCloudSaved,
  });

  useEffect(() => {
    let active = true;
    // Primero los datos locales: la app debe abrirse aunque falle Supabase.
    hydrateLocalSnapshot();
    const supabase = createSupabaseClient();
    supabaseRef.current = supabase;

    function hydrateLocalSnapshot() {
      try {
        const localStore = applyRuntimePreferences(loadExpenseStore());
        saveExpenseStore(localStore);
        if (active) onHydrate(localStore);
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
      const localDirty = hasUnsyncedChangesFor(readSyncMeta(), user.id);
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

        const latestLocalStore = applyRuntimePreferences(loadExpenseStore());
        const { mergedStore, shouldSaveCloud } = resolveHydratedStore({
          initialLocalStore,
          latestLocalStore,
          cloudStore: cloud.store,
          revisionAtCloudLoad: revisionBeforeCloudHydration,
          currentRevision: localRevisionRef.current,
          localDirty,
        });
        const ownedStore = assignExpenseStoreOwner(mergedStore, user.id);
        // La fusión incluye las ediciones hechas mientras cargaba la nube:
        // sin hidratarla, el siguiente guardado subiría el estado sin lo que
        // solo estaba en la nube.
        saveExpenseStore(ownedStore);
        if (active) onHydrate(ownedStore);
        markHydrated();
        syncedUserIdRef.current = user.id;
        syncingUserIdRef.current = null;

        if (shouldSaveCloud) {
          const revisionAtSave = localRevisionRef.current;
          const saved = await saveCloudStore(supabase, user, ownedStore);
          if (!active || syncRunRef.current !== syncRun) return;
          cloudReadyRef.current = saved.mode === "table";
          markCloudSaved(revisionAtSave, user.id);
          markSynced(saved.mode);
          // Lo editado mientras subía la fusión no pudo encolarse aún.
          if (localRevisionRef.current !== revisionAtSave) {
            queueCloudSave(
              assignExpenseStoreOwner(loadExpenseStore(), user.id),
              localRevisionRef.current,
            );
          }
          return;
        }

        writeSyncMeta({ ownerId: user.id, dirty: false });
        cloudReadyRef.current = cloud.mode === "table";
        markSynced(cloud.mode);
      } catch (error) {
        syncingUserIdRef.current = null;
        cloudReadyRef.current = false;
        markHydrated();
        if (hasUnsyncedChangesFor(readSyncMeta(), user.id)) {
          markPending();
        } else {
          markError(error, "settings.cloudSyncError");
        }
      }
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
          if (!data.user && isAuthRetryableFetchError(error)) return;
          return syncAuthenticatedUser(data.user ?? null);
        })
        .catch((error: unknown) => {
          cloudReadyRef.current = false;
          markError(error, "settings.cloudSyncError");
        });
    };

    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      void syncAuthenticatedUser(session?.user ?? null);
    }) ?? { data: { subscription: null } };

    const frame = window.requestAnimationFrame(() => refreshAuthRef.current());

    // Al recuperar la red o volver a la app se reintenta lo pendiente; si la
    // nube no llegó a cargar, se vuelve a sincronizar (y a fusionar).
    function resumeSync() {
      retryQueuedSave();
      if (!cloudReadyRef.current) refreshAuthRef.current();
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
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      subscription?.unsubscribe();
      window.removeEventListener("online", resumeSync);
      window.removeEventListener("pagehide", flushBeforeLeaving);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearQueuedSave();
    };
  }, [
    clearQueuedSave,
    flushQueuedSave,
    markCloudSaved,
    markError,
    markLocal,
    markPending,
    markSynced,
    markSyncing,
    onHydrate,
    queueCloudSave,
    retryQueuedSave,
  ]);

  useEffect(() => {
    refreshAuthRef.current();
  }, [pathname]);

  // Guarda en el dispositivo y lo marca pendiente de subir antes de intentar
  // la nube: si la app se cierra o no hay red, la siguiente sincronización
  // fusiona estos cambios en lugar de descartarlos.
  function saveLocally(nextStore: ExpenseStore) {
    const ownedStore = assignExpenseStoreOwner(nextStore, userRef.current?.id);
    localRevisionRef.current += 1;
    saveExpenseStore(ownedStore);
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
