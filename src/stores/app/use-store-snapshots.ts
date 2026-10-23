"use client";

import { useCallback, useEffect } from "react";
import type { SnapshotReason } from "@/data/persistence/snapshot-policy";
import { getSnapshotRepository } from "@/data/persistence/snapshot-store";
import type { ExpenseStore } from "@/domain/types";

// Se espera un poco tras hidratar: así la copia diaria recoge ya lo que trae
// la primera sincronización y no compite con el arranque.
export const DAILY_SNAPSHOT_DELAY_MS = 4_000;
// Lo máximo que una operación espera a su copia de seguridad.
export const SNAPSHOT_TIMEOUT_MS = 3_000;

// Copia diaria automática del store en este dispositivo (al abrir la app y al
// volver a ella) y copias de seguridad antes de las operaciones que sustituyen
// o borran datos. Un fallo al copiar nunca bloquea la operación.
export function useStoreSnapshots({
  isHydrated,
  getStore,
}: {
  isHydrated: boolean;
  getStore: () => ExpenseStore;
}) {
  useEffect(() => {
    if (!isHydrated) return;
    const repository = getSnapshotRepository();
    if (!repository) return;

    const takeDailySnapshot = () => {
      void repository.saveDaily(getStore()).catch((error: unknown) => {
        console.error("Daily snapshot failed", error);
      });
    };
    const takeWhenVisible = () => {
      if (document.visibilityState === "visible") takeDailySnapshot();
    };
    const timer = window.setTimeout(takeDailySnapshot, DAILY_SNAPSHOT_DELAY_MS);
    document.addEventListener("visibilitychange", takeWhenVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", takeWhenVisible);
    };
  }, [getStore, isHydrated]);

  const captureSnapshot = useCallback(
    async (store: ExpenseStore, reason: SnapshotReason) => {
      const repository = getSnapshotRepository();
      if (!repository) return null;
      let timer = 0;
      try {
        // Si IndexedDB no responde, la operación sigue sin su copia.
        return await Promise.race([
          repository.save(store, reason),
          new Promise<null>((resolve) => {
            timer = window.setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS);
          }),
        ]);
      } catch (error) {
        console.error("Snapshot failed", error);
        return null;
      } finally {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  return { captureSnapshot };
}
