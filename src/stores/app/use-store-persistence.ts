"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import {
  loadExpenseStore,
  saveExpenseStore,
} from "@/data/persistence/local-store";
import { assignExpenseStoreOwner } from "@/data/persistence/store-normalization";
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
    markError,
  } = useSyncState();
  const {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
  } = useCloudSaveQueue({
    supabaseRef,
    userRef,
    cloudReadyRef,
    markSyncing,
    markSaved,
    markError,
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabaseRef.current = supabase;

    function hydrateLocalSnapshot() {
      const localStore = applyRuntimePreferences(loadExpenseStore());
      saveExpenseStore(localStore);
      if (active) onHydrate(localStore);
      markHydrated();
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
        const {
          mergedStore,
          shouldHydrateReactState,
          shouldSaveCloud,
        } = resolveHydratedStore({
          initialLocalStore,
          latestLocalStore,
          cloudStore: cloud.store,
          revisionAtCloudLoad: revisionBeforeCloudHydration,
          currentRevision: localRevisionRef.current,
        });
        const ownedStore = assignExpenseStoreOwner(mergedStore, user.id);
        saveExpenseStore(ownedStore);
        if (active && shouldHydrateReactState) {
          onHydrate(ownedStore);
        }
        markHydrated();
        syncedUserIdRef.current = user.id;
        syncingUserIdRef.current = null;

        if (shouldSaveCloud) {
          const saved = await saveCloudStore(supabase, user, ownedStore);
          if (!active || syncRunRef.current !== syncRun) return;
          cloudReadyRef.current = saved.mode === "table";
          markSynced(saved.mode);
          return;
        }

        cloudReadyRef.current = cloud.mode === "table";
        markSynced(cloud.mode);
      } catch (error) {
        syncingUserIdRef.current = null;
        cloudReadyRef.current = false;
        markHydrated();
        markError(error, "settings.cloudSyncError");
      }
    }

    hydrateLocalSnapshot();

    refreshAuthRef.current = () => {
      if (!supabase) {
        markUnauthenticated();
        return;
      }

      void supabase.auth
        .getUser()
        .then(({ data }) => syncAuthenticatedUser(data.user ?? null))
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

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      subscription?.unsubscribe();
      clearQueuedSave();
    };
  }, [
    clearQueuedSave,
    markError,
    markLocal,
    markSynced,
    markSyncing,
    onHydrate,
  ]);

  useEffect(() => {
    refreshAuthRef.current();
  }, [pathname]);

  function persist(nextStore: ExpenseStore, onPersist: (store: ExpenseStore) => void) {
    const ownedStore = assignExpenseStoreOwner(nextStore, userRef.current?.id);
    localRevisionRef.current += 1;
    saveExpenseStore(ownedStore);
    onPersist(ownedStore);
    queueCloudSave(ownedStore);
  }

  async function persistImmediately(
    nextStore: ExpenseStore,
    onPersist: (store: ExpenseStore) => void,
    syncingMessage: string,
  ) {
    const ownedStore = assignExpenseStoreOwner(nextStore, userRef.current?.id);
    localRevisionRef.current += 1;
    saveExpenseStore(ownedStore);
    onPersist(ownedStore);

    try {
      await saveImmediately(ownedStore, syncingMessage);
    } catch (error) {
      markError(error, "settings.cloudSaveError");
    }
  }

  return {
    persist,
    persistImmediately,
    syncStatus,
    syncMessage,
    isHydrated,
  };
}
