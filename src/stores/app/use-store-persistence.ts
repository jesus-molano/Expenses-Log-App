"use client";

import { useEffect, useRef, useState } from "react";
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
  const supabaseRef = useRef<AppSupabaseClient | null>(null);
  const userRef = useRef<User | null>(null);
  const hydratedRef = useRef(false);
  const localRevisionRef = useRef(0);
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
    hydratedRef,
    markSyncing,
    markSaved,
    markError,
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabaseRef.current = supabase;

    async function hydrate() {
      const localStore = applyRuntimePreferences(loadExpenseStore());
      saveExpenseStore(localStore);
      if (active) onHydrate(localStore);

      if (!supabase) {
        markHydrated();
        return;
      }

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!active || !user) {
        markHydrated();
        markLocal();
        return;
      }

      userRef.current = user;
      markSyncing(t("settings.preparingCloud"));

      try {
        const cloud = await loadCloudStore(supabase, user);
        if (!active) return;

        const revisionAtCloudLoad = localRevisionRef.current;
        const latestLocalStore = applyRuntimePreferences(loadExpenseStore());
        const { mergedStore, shouldHydrateReactState } = resolveHydratedStore({
          initialLocalStore: localStore,
          latestLocalStore,
          cloudStore: cloud.store,
          revisionAtCloudLoad,
          currentRevision: localRevisionRef.current,
        });
        const ownedStore = assignExpenseStoreOwner(mergedStore, user.id);
        saveExpenseStore(ownedStore);
        if (active && shouldHydrateReactState) {
          onHydrate(ownedStore);
        }
        markHydrated();

        const saved = await saveCloudStore(supabase, user, ownedStore);
        if (!active) return;
        markSynced(saved.mode);
      } catch (error) {
        markHydrated();
        markError(error, "settings.cloudSyncError");
      }
    }

    const frame = window.requestAnimationFrame(() => void hydrate());

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      clearQueuedSave();
    };

    function markHydrated() {
      hydratedRef.current = true;
      setIsHydrated(true);
    }

  }, [
    clearQueuedSave,
    markError,
    markLocal,
    markSynced,
    markSyncing,
    onHydrate,
  ]);

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
