"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import { saveCloudStore } from "@/data/persistence/cloud-store";
import { t, type TranslationKey } from "@/shared/i18n";
import { createCloudSaveQueue, type CloudSaveQueue } from "./cloud-save-queue";
import { shouldQueueCloudSave } from "./sync-policy";

type CloudSaveQueueOptions = {
  supabaseRef: RefObject<AppSupabaseClient | null>;
  userRef: RefObject<User | null>;
  cloudReadyRef: RefObject<boolean>;
  markSyncing: (message: string) => void;
  markSaved: (mode: "table" | "unavailable") => void;
  markPending: () => void;
  markError: (error: unknown, fallbackKey: TranslationKey) => void;
  onCloudSaved: (revision: number, userId: string) => void;
};

export function useCloudSaveQueue({
  supabaseRef,
  userRef,
  cloudReadyRef,
  markSyncing,
  markSaved,
  markPending,
  markError,
  onCloudSaved,
}: CloudSaveQueueOptions) {
  const syncingMessageRef = useRef<string | null>(null);
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
      onSaving: () => {
        markSyncing(syncingMessageRef.current ?? t("settings.savingChanges"));
        syncingMessageRef.current = null;
      },
      onSaved: ({ mode, revision, userId, hasNewerChanges }) => {
        onCloudSaved(revision, userId);
        if (!hasNewerChanges) markSaved(mode);
      },
      onFailed: (error, { willRetry }) => {
        if (willRetry || !navigator.onLine) {
          markPending();
        } else {
          markError(error, "settings.cloudSaveError");
        }
      },
    });
    return queueRef.current;
  }, [
    cloudReadyRef,
    markError,
    markPending,
    markSaved,
    markSyncing,
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
    async (nextStore: ExpenseStore, revision: number, syncingMessage: string) => {
      const queue = getQueue();
      queue.enqueue(nextStore, revision);
      syncingMessageRef.current = syncingMessage;
      try {
        await queue.flush();
      } finally {
        syncingMessageRef.current = null;
      }
    },
    [getQueue],
  );

  const clearQueuedSave = useCallback(() => queueRef.current?.clear(), []);
  const flushQueuedSave = useCallback(() => getQueue().flush(), [getQueue]);
  const retryQueuedSave = useCallback(() => getQueue().retryNow(), [getQueue]);

  return {
    queueCloudSave,
    saveImmediately,
    clearQueuedSave,
    flushQueuedSave,
    retryQueuedSave,
  };
}
