"use client";

import { useAppBadge } from "@/features/expenses/hooks/use-app-badge";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { useExpenseStore } from "@/stores/app/use-expense-store";

// Mantiene el número del icono de la app al día en cualquier pantalla.
export function AppBadgeSync() {
  const { store } = useExpenseStore();
  const now = useCurrentDate();
  useAppBadge(store, now);
  return null;
}
