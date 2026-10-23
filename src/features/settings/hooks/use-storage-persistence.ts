"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readStoragePersistence,
  requestStoragePersistence,
  type StoragePersistence,
} from "@/data/persistence/persistent-storage";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

export function useStoragePersistence({
  language,
  onMessage,
}: {
  language: AppLanguage;
  onMessage: (message: string) => void;
}) {
  const [state, setState] = useState<StoragePersistence | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    setState(await readStoragePersistence());
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(initialCheck);
  }, [refresh]);

  async function request() {
    setRequesting(true);
    try {
      const granted = await requestStoragePersistence();
      onMessage(t(granted ? "backup.storageGranted" : "backup.storageDenied", language));
      await refresh();
    } finally {
      setRequesting(false);
    }
  }

  return { state, requesting, request };
}
