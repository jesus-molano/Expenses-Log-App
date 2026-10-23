"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { saveCloudStore } from "@/data/persistence/cloud-store";
import { t } from "@/shared/i18n";
import { createCloudSaveQueue, type CloudSaveQueue } from "./cloud-save-queue";
import { shouldQueueCloudSave } from "./sync-policy";

type CloudSaveQueueOptions = {
  supabaseRef: RefObject<AppSupabaseClient | null>;
  userRef: RefObject<User | null>;
  cloudReadyRef: RefObject<boolean>;
  markSyncing: (message: string) => void;
  markSaved: (mode: "table" | "unavailable") => void;
  onCloudSaved: (
    revision: number,
    userId: string,
    mode: "table" | "unavailable",
  ) => void;
  onCloudSaveFailed: (error: unknown) => void;
};

export function useCloudSaveQueue({
  supabaseRef,
  userRef,
  cloudReadyRef,
  markSyncing,
  markSaved,
  onCloudSaved,
  onCloudSaveFailed,
}: CloudSaveQueueOptions) {
  const queueRef = useRef<CloudSaveQueue | null>(null);

  // Se crea al primer uso (fuera del render) y vive lo que el provider.
  const getQueue = useCallback(() => {
    queueRef.current ??= createCloudSaveQueue({
      resolveTarget: () => {
        const supabase = supabaseRef.current;
        const user = userRef.current;
        if (
          !shouldQueueCloudSave({
            hydrated: cloudReadyRef.current,
            hasSupabase: Boolean(supabase),
            hasUser: Boolean(user),
          }) ||
          !supabase ||
          !user
        ) {
          return null;
        }
        return {
          userId: user.id,
          save: (store) => saveCloudStore(supabase, user, store),
        };
      },
      onSaving: (message) => markSyncing(message ?? t("settings.savingChanges")),
      onSaved: ({ mode, revision, userId, hasNewerChanges }) => {
        onCloudSaved(revision, userId, mode);
        if (!hasNewerChanges) markSaved(mode);
      },
      onFailed: onCloudSaveFailed,
    });
    return queueRef.current;
  }, [
    cloudReadyRef,
    markSaved,
    markSyncing,
    onCloudSaveFailed,
    onCloudSaved,
    supabaseRef,
    userRef,
  ]);

  const queueCloudSave = useCallback(
    (nextStore: ExpenseStore, revision: number) => {
      getQueue().enqueue(nextStore, revision);
    },
    [getQueue],
  );

  const saveImmediately = useCallback(
    (nextStore: ExpenseStore, revision: number, syncingMessage: string) =>
      getQueue().saveNow(nextStore, revision, syncingMessage),
    [getQueue],
  );

  const clearQueuedSave = useCallback(() => queueRef.current?.clear(), []);
  const flushQueuedSave = useCallback(() => getQueue().flush(), [getQueue]);

  return {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
    flushQueuedSave,
  };
}
