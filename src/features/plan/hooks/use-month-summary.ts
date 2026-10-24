"use client";

import { useMemo } from "react";
import { resolveBudgetCycle } from "@/domain/budget-cycle";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildMonthSummary } from "../lib/month-summary";

// Resumen de un mes para la hoja "Resumen de <mes>".
export function useMonthSummary({
  store,
  monthId,
  today,
  language,
}: {
  store: ExpenseStore;
  monthId: string;
  // YYYY-MM-DD
  today: string;
  language: AppLanguage;
}) {
  return useMemo(
    () =>
      buildMonthSummary(store, monthId, {
        today: new Date(`${today}T12:00:00`),
        cycle: resolveBudgetCycle(store.finance),
        language,
      }),
    [language, monthId, store, today],
  );
}
