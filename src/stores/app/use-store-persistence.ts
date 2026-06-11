"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ExpenseStore } from "@/domain/types";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import {
  loadExpenseStore,
  saveExpenseStore,
} from "@/data/persistence/local-store";
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
  const supabaseRef = useRef<SupabaseClient | null>(null);
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
        saveExpenseStore(mergedStore);
        if (active && shouldHydrateReactState) {
          onHydrate(mergedStore);
        }
        markHydrated();

        const saved = await saveCloudStore(supabase, user, mergedStore);
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
    localRevisionRef.current += 1;
    saveExpenseStore(nextStore);
    onPersist(nextStore);
    queueCloudSave(nextStore);
  }

  async function persistImmediately(
    nextStore: ExpenseStore,
    onPersist: (store: ExpenseStore) => void,
    syncingMessage: string,
  ) {
    localRevisionRef.current += 1;
    saveExpenseStore(nextStore);
    onPersist(nextStore);

    try {
      await saveImmediately(nextStore, syncingMessage);
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
