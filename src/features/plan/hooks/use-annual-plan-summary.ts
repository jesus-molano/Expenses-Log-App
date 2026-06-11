"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";

export function useAnnualPlanSummary(store: ExpenseStore, today: Date) {
  const annualOccurrences = useMemo(() => {
    const year = today.getFullYear();

    return generateOccurrences(
      store.templates,
      store.overrides,
      `${year}-01-01`,
      `${year}-12-31`,
    );
  }, [store.overrides, store.templates, today]);

  const annualExpensesTotal = annualOccurrences.reduce(
    (sum, occurrence) =>
      occurrence.status === "skipped"
        ? sum
        : sum + occurrence.template.amount,
    0,
  );

  const annualSavingsEstimate =
    store.finance.allocation.monthlySavingsTarget * 12 +
    store.finance.incomeEvents
      .filter((event) => event.receivedAt.startsWith(String(today.getFullYear())))
      .reduce((sum, event) => sum + event.amount, 0);

  return {
    annualExpensesTotal,
    annualExpensesTotalLabel: formatCurrency(annualExpensesTotal),
    annualSavingsEstimate,
    annualSavingsEstimateLabel: formatCurrency(annualSavingsEstimate),
  };
}
