"use client";

import { useEffect, useMemo } from "react";
import { toDateOnly } from "@/domain/calendar";
import { countAttentionOccurrences } from "@/domain/reminder-schedule";
import type { ExpenseStore } from "@/domain/types";

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

// Número en el icono de la app instalada: recibos vencidos y los que vencen
// hoy. Se recalcula al cambiar el store o el día; donde no hay Badging API
// (iOS sin instalar, Firefox) no hace nada.
export function useAppBadge(store: ExpenseStore, now: Date) {
  const todayKey = toDateOnly(now);
  const count = useMemo(
    () => countAttentionOccurrences(store, new Date(`${todayKey}T12:00:00`)),
    [store, todayKey],
  );

  useEffect(() => {
    const badgeNavigator = navigator as BadgeNavigator;
    if (!badgeNavigator.setAppBadge) return;
    const update =
      count > 0
        ? badgeNavigator.setAppBadge(count)
        : (badgeNavigator.clearAppBadge?.() ?? badgeNavigator.setAppBadge(0));
    update.catch(() => {
      // Sin permiso o sin instalar: el navegador lo rechaza y no pasa nada.
    });
  }, [count]);

  return count;
}
