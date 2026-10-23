"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoreSnapshot } from "@/data/persistence/snapshot-policy";
import {
  getSnapshotRepository,
  SNAPSHOTS_UPDATED_EVENT,
} from "@/data/persistence/snapshot-store";
import { hasUserData } from "@/domain/store-summary";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";

type SnapshotsState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; snapshots: StoreSnapshot[]; loadError: boolean };

// Lista de copias automáticas de este dispositivo, restaurar una y guardar
// otra a mano. Se recarga sola cuando la app guarda una copia nueva.
export function useSnapshots({
  language,
  onMessage,
}: {
  language: AppLanguage;
  onMessage: (message: string) => void;
}) {
  const { store, restoreSnapshot, takeSnapshot } = useExpenseStore();
  const [state, setState] = useState<SnapshotsState>({ status: "loading" });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const repository = getSnapshotRepository();
    if (!repository) {
      setState({ status: "unavailable" });
      return;
    }
    try {
      setState({ status: "ready", snapshots: await repository.list(), loadError: false });
    } catch (error) {
      console.error("Could not read snapshots", error);
      setState({ status: "ready", snapshots: [], loadError: true });
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load();
    }, 0);
    const reload = () => void load();
    window.addEventListener(SNAPSHOTS_UPDATED_EVENT, reload);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(SNAPSHOTS_UPDATED_EVENT, reload);
    };
  }, [load]);

  async function restore(snapshot: StoreSnapshot) {
    setRestoringId(snapshot.id);
    try {
      await restoreSnapshot(snapshot.store);
      onMessage(t("backup.restored", language));
      return true;
    } catch (error) {
      console.error("Restore failed", error);
      onMessage(t("backup.restoreFailed", language));
      return false;
    } finally {
      setRestoringId(null);
    }
  }

  async function saveNow() {
    if (!hasUserData(store)) {
      onMessage(t("backup.snapshotNothingToSave", language));
      return;
    }
    setSaving(true);
    try {
      const saved = await takeSnapshot("manual");
      onMessage(t(saved ? "backup.snapshotCreated" : "backup.snapshotFailed", language));
    } finally {
      setSaving(false);
    }
  }

  return {
    available: state.status !== "unavailable",
    loading: state.status === "loading",
    snapshots: state.status === "ready" ? state.snapshots : [],
    loadError: state.status === "ready" && state.loadError,
    restoringId,
    saving,
    restore,
    saveNow,
  };
}
