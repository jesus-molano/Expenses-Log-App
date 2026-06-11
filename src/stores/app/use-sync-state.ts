"use client";

import { useCallback, useState } from "react";
import { t, type TranslationKey } from "@/shared/i18n";
import { errorMessage, savedMessage, syncedMessage } from "./sync-messages";
import type { SyncStatus } from "./store-types";

export function useSyncState() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncMessage, setSyncMessage] = useState(() => t("common.localMode"));

  const markLocal = useCallback(() => {
    setSyncStatus("local");
    setSyncMessage(t("common.localMode"));
  }, []);

  const markSyncing = useCallback((message: string) => {
    setSyncStatus("syncing");
    setSyncMessage(message);
  }, []);

  const markSynced = useCallback((mode: "table" | "unavailable") => {
    setSyncStatus("synced");
    setSyncMessage(syncedMessage(mode));
  }, []);

  const markSaved = useCallback((mode: "table" | "unavailable") => {
    setSyncStatus("synced");
    setSyncMessage(savedMessage(mode));
  }, []);

  const markError = useCallback((error: unknown, fallbackKey: TranslationKey) => {
    setSyncStatus("error");
    setSyncMessage(errorMessage(error, fallbackKey));
  }, []);

  return {
    syncStatus,
    syncMessage,
    markLocal,
    markSyncing,
    markSynced,
    markSaved,
    markError,
  };
}
