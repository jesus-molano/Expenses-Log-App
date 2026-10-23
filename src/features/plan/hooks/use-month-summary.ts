"use client";

import { useMemo, useState } from "react";
import { resolveBudgetCycle, type BudgetCycle } from "@/domain/budget-cycle";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildMonthSummary, summaryPromptMonth } from "../lib/month-summary";

// Hoja "Resumen de <mes>": qué mes está abierto y su resumen.
export function useMonthSummary({
  store,
  today,
  language,
}: {
  store: ExpenseStore;
  // YYYY-MM-DD
  today: string;
  language: AppLanguage;
}) {
  const [monthId, setMonthId] = useState<string | null>(null);
  const summary = useMemo(
    () =>
      monthId
        ? buildMonthSummary(store, monthId, {
            today: new Date(`${today}T12:00:00`),
            cycle: resolveBudgetCycle(store.finance),
            language,
          })
        : null,
    [language, monthId, store, today],
  );

  return {
    summary,
    open: (nextMonthId: string) => setMonthId(nextMonthId),
    close: () => setMonthId(null),
  };
}

// Resumen que Plan ofrece por su cuenta (al cerrar un mes, al empezar el
// siguiente o en sus últimos días), si ese mes tuvo recibos.
export function useMonthSummaryPrompt({
  store,
  today,
  language,
  cycle,
  calendarMonthId,
  activeMonthId,
}: {
  store: ExpenseStore;
  today: string;
  language: AppLanguage;
  cycle: BudgetCycle;
  calendarMonthId: string;
  activeMonthId: string;
}) {
  return useMemo(() => {
    const monthId = summaryPromptMonth({ today, calendarMonthId, activeMonthId, cycle });
    if (!monthId) return null;
    const summary = buildMonthSummary(store, monthId, {
      today: new Date(`${today}T12:00:00`),
      cycle,
      language,
    });
    return summary.plannedCount > 0 ? summary : null;
  }, [activeMonthId, calendarMonthId, cycle, language, store, today]);
}
