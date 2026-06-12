"use client";

import { useMemo } from "react";
import { endOfMonth, startOfMonth } from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import { buildMonthlyMoneyPlan, isEventInMonth } from "@/domain/finance";
import { generateOccurrences } from "@/domain/recurrence";
import type { AppLanguage, ExpenseStore } from "@/domain/types";

export function useCurrentMonthPlan(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage,
) {
  const occurrences = useMemo(
    () =>
      generateOccurrences(
        store.templates,
        store.overrides,
        toDateOnly(startOfMonth(today)),
        toDateOnly(endOfMonth(today)),
        language,
      ),
    [store.templates, store.overrides, today, language],
  );

  const plan = useMemo(
    () =>
      buildMonthlyMoneyPlan({
        monthDate: today,
        finance: store.finance,
        occurrences,
      }),
    [occurrences, store.finance, today],
  );

  const monthlyIncomeEvents = useMemo(
    () =>
      store.finance.incomeEvents.filter((event) =>
        isEventInMonth(event, today),
      ),
    [store.finance.incomeEvents, today],
  );

  return {
    currentMonthOccurrences: occurrences,
    plan,
    monthlyIncomeEvents,
  };
}
