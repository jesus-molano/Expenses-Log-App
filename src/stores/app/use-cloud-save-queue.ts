"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { saveCloudStore } from "@/data/persistence/cloud-store";
import { t, type TranslationKey } from "@/shared/i18n";
import { shouldQueueCloudSave } from "./sync-policy";

type CloudSaveQueueOptions = {
  supabaseRef: RefObject<AppSupabaseClient | null>;
  userRef: RefObject<User | null>;
  cloudReadyRef: RefObject<boolean>;
  markSyncing: (message: string) => void;
  markSaved: (mode: "table" | "unavailable") => void;
  markError: (error: unknown, fallbackKey: TranslationKey) => void;
};

export function useCloudSaveQueue({
  supabaseRef,
  userRef,
  cloudReadyRef,
  markSyncing,
  markSaved,
  markError,
}: CloudSaveQueueOptions) {
  const saveTimerRef = useRef<number | null>(null);

  const clearQueuedSave = useCallback(() => {
    if (!saveTimerRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  const saveImmediately = useCallback(
    async (nextStore: ExpenseStore, syncingMessage: string) => {
      clearQueuedSave();

      const supabase = supabaseRef.current;
      const user = userRef.current;

      if (!cloudReadyRef.current || !supabase || !user) return;

      markSyncing(syncingMessage);
      const result = await saveCloudStore(supabase, user, nextStore);
      markSaved(result.mode);
    },
    [clearQueuedSave, cloudReadyRef, markSaved, markSyncing, supabaseRef, userRef],
  );

  const queueCloudSave = useCallback(
    (nextStore: ExpenseStore) => {
      const supabase = supabaseRef.current;
      const user = userRef.current;
      if (
        !shouldQueueCloudSave({
          hydrated: cloudReadyRef.current,
          hasSupabase: Boolean(supabase),
          hasUser: Boolean(user),
        })
      ) {
        return;
      }
      if (!supabase || !user) return;

      clearQueuedSave();
      saveTimerRef.current = window.setTimeout(() => {
        markSyncing(t("settings.savingChanges"));
        void saveCloudStore(supabase, user, nextStore)
          .then((result) => markSaved(result.mode))
          .catch((error: unknown) =>
            markError(error, "settings.cloudSaveError"),
          );
      }, 350);
    },
    [
      clearQueuedSave,
      cloudReadyRef,
      markError,
      markSaved,
      markSyncing,
      supabaseRef,
      userRef,
    ],
  );

  return {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
  };
}
