"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import type { CloudStoreSaveResult } from "@/data/persistence/cloud-store";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { t } from "@/shared/i18n";
import { createCloudSaveQueue, type CloudSaveQueue } from "./cloud-save-queue";
import { shouldQueueCloudSave } from "./sync-policy";

type CloudSaveQueueOptions = {
  supabaseRef: RefObject<AppSupabaseClient | null>;
  userRef: RefObject<User | null>;
  cloudReadyRef: RefObject<boolean>;
  // Guardado con CAS y fusión ante conflicto, de `useStorePersistence`.
  saveToCloud: (
    supabase: AppSupabaseClient,
    user: User,
    store: ExpenseStore,
  ) => Promise<CloudStoreSaveResult>;
  resolveConflict: (
    supabase: AppSupabaseClient,
    user: User,
    store: ExpenseStore,
  ) => Promise<ExpenseStore>;
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
  saveToCloud,
  resolveConflict,
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
          save: (store) => saveToCloud(supabase, user, store),
          resolveConflict: (store) => resolveConflict(supabase, user, store),
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
    resolveConflict,
    saveToCloud,
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
  const rebaseQueuedSave = useCallback(
    (nextStore: ExpenseStore) => queueRef.current?.rebase(nextStore),
    [],
  );
  const isQueueIdle = useCallback(() => queueRef.current?.isIdle() ?? true, []);

  return {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
    flushQueuedSave,
    rebaseQueuedSave,
    isQueueIdle,
  };
}
