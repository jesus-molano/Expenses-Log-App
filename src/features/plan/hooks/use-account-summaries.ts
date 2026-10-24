"use client";

import { useMemo } from "react";
import { periodRange, type BudgetCycle } from "@/domain/budget-cycle";
import { getMonthlySavingsTarget } from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import {
  billsCoverage,
  pendingInBudgetMonth,
  summarizeAccounts,
} from "../lib/account-summary";

// Cuentas con sus saldos y lo que se compara con ellos en el mes activo: lo
// que queda por pagar (cuentas de recibos) y el objetivo de ahorro.
export function useAccountSummaries({
  store,
  activeMonthId,
  cycle,
  language,
}: {
  store: ExpenseStore;
  activeMonthId: string;
  cycle: BudgetCycle;
  language: AppLanguage;
}) {
  return useMemo(() => {
    const summaries = summarizeAccounts(store.finance);
    const hasBills = summaries.some((summary) => summary.account.role === "bills");
    const coverage = hasBills
      ? billsCoverage(summaries, {
          pending: pendingInBudgetMonth(store, activeMonthId, cycle, language),
          monthStart: periodRange(activeMonthId, cycle).start,
        })
      : null;
    return {
      summaries,
      coverage,
      savingsTarget: getMonthlySavingsTarget(store.finance, activeMonthId),
    };
  }, [activeMonthId, cycle, language, store]);
}
