"use client";

import { useMemo } from "react";
import { activeBudgetMonth } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type { ExpenseStore } from "@/domain/types";
import { useCurrentDate } from "@/shared/hooks/use-current-date";

// Lo que Cuentas y Previsión miran de hoy: el mes activo (el natural, o el
// siguiente si el natural está cerrado) y el ciclo de Ajustes. No siguen al
// mes que se mira en Gastos y Mes: no tienen barra de mes.
export function useActiveBudgetMonth(store: ExpenseStore) {
  const today = useCurrentDate();
  const todayDateOnly = toDateOnly(today);
  const active = useMemo(
    () => activeBudgetMonth(store.finance, todayDateOnly),
    [store.finance, todayDateOnly],
  );
  return {
    language: store.preferences?.language ?? "es",
    today,
    todayDateOnly,
    activeMonthId: active.monthId,
    cycle: active.cycle,
  };
}
