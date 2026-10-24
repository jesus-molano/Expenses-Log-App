"use client";

import { useMemo } from "react";
import { parseISO } from "date-fns";
import { periodRange, type BudgetCycle } from "@/domain/budget-cycle";
import { buildPaydayOutlook } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import { buildMonthlyMoneyPlan } from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { monthReceipts } from "../lib/month-receipts";
import { incomeEventsInMonth, occurrencesForMonth } from "../lib/plan-dashboard";

// Plan del mes que se mira en Mes: sus recibos (con los pendientes primero),
// el plan con su fase frente al mes activo, "Hasta el cobro" (solo en el
// activo) y los ingresos puntuales de sus días.
export function useMonthPlan({
  store,
  viewMonthId,
  activeMonthId,
  cycle,
  today,
  language,
}: {
  store: ExpenseStore;
  viewMonthId: string;
  activeMonthId: string;
  cycle: BudgetCycle;
  today: Date;
  language: AppLanguage;
}) {
  return useMemo(() => {
    const monthDate = parseISO(`${viewMonthId}-01`);
    const occurrences = occurrencesForMonth(store, monthDate, language, cycle);
    const plan = buildMonthlyMoneyPlan({
      monthDate,
      finance: store.finance,
      occurrences,
      today,
      activeMonthId,
      range: periodRange(viewMonthId, cycle),
    });
    return {
      plan,
      receipts: monthReceipts(occurrences),
      paydayOutlook:
        viewMonthId === activeMonthId
          ? buildPaydayOutlook(store, toDateOnly(today), language)
          : null,
      incomeEvents: incomeEventsInMonth(store.finance, viewMonthId, cycle),
    };
  }, [activeMonthId, cycle, language, store, today, viewMonthId]);
}
