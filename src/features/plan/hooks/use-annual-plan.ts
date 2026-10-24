"use client";

import { useMemo, useState } from "react";
import type { BudgetCycle } from "@/domain/budget-cycle";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildSeriesItem, getAvailableYears } from "../lib/plan-dashboard";

// "Plan anual" de Previsión: los doce meses del año elegido (por defecto, el
// del mes activo), los años que se pueden elegir y sus totales.
export function useAnnualPlan({
  store,
  today,
  language,
  activeMonthId,
  cycle,
}: {
  store: ExpenseStore;
  today: Date;
  language: AppLanguage;
  activeMonthId: string;
  cycle: BudgetCycle;
}) {
  const activeYear = Number(activeMonthId.slice(0, 4));
  const [yearOverride, setYearOverride] = useState<number | null>(null);
  const year = yearOverride ?? activeYear;

  const moneySeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        buildSeriesItem(store, new Date(year, index, 1), today, language, activeMonthId, cycle),
      ),
    [activeMonthId, cycle, language, store, today, year],
  );
  // Al pasar de diciembre a enero, el año activo también se puede elegir.
  const availableYears = useMemo(
    () => getAvailableYears(store, today, [activeMonthId]).sort((a, b) => a - b),
    [activeMonthId, store, today],
  );
  const totals = useMemo(
    () =>
      moneySeries.reduce(
        (sum, item) => ({
          expenses: sum.expenses + (item.plannedExpenses ?? item.expenses),
          paid: sum.paid + (item.paid ?? 0),
          savings: sum.savings + item.savings,
          capacity: sum.capacity + (item.capacity ?? 0),
        }),
        { expenses: 0, paid: 0, savings: 0, capacity: 0 },
      ),
    [moneySeries],
  );

  return {
    year,
    availableYears,
    moneySeries,
    totals,
    selectYear: (next: number) => setYearOverride(next === activeYear ? null : next),
  };
}
