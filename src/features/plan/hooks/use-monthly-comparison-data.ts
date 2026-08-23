"use client";

import { useMemo } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toDateOnly } from "@/domain/calendar";
import { generateStoreOccurrences, isEventInMonth } from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import type { MoneySeriesItem } from "../types";

type UseMonthlyComparisonDataOptions = {
  store: ExpenseStore;
  language: AppLanguage;
  moneySeries: MoneySeriesItem[];
  today: Date;
  selectedMonth: string;
  selectedExpensesExpanded: boolean;
};

export function useMonthlyComparisonData({
  store,
  language,
  moneySeries,
  today,
  selectedMonth,
  selectedExpensesExpanded,
}: UseMonthlyComparisonDataOptions) {
  const selectedMonthSummary = useMemo(() => {
    const effectiveSelectedMonth = moneySeries.some(
      (item) => item.id === selectedMonth,
    )
      ? selectedMonth
      : moneySeries.at(-1)?.id;

    return (
      moneySeries.find((item) => item.id === effectiveSelectedMonth) ??
      emptyMonthSummary(today, language)
    );
  }, [language, moneySeries, selectedMonth, today]);

  const selectedMonthDate = useMemo(
    () => new Date(`${selectedMonthSummary.id}T00:00:00`),
    [selectedMonthSummary.id],
  );

  const selectedMonthIncomeEvents = useMemo(
    () =>
      store.finance.incomeEvents.filter((event) =>
        isEventInMonth(event, selectedMonthDate),
      ),
    [selectedMonthDate, store.finance.incomeEvents],
  );

  const selectedMonthOccurrences = useMemo(
    () =>
      generateStoreOccurrences(
        store,
        toDateOnly(startOfMonth(selectedMonthDate)),
        toDateOnly(endOfMonth(selectedMonthDate)),
        language,
      ).filter((occurrence) => occurrence.status !== "skipped"),
    [selectedMonthDate, store, language],
  );

  const visibleSelectedMonthOccurrences = selectedExpensesExpanded
    ? selectedMonthOccurrences
    : selectedMonthOccurrences.slice(0, 6);

  return {
    selectedMonthSummary,
    selectedMonthIncomeEvents,
    selectedMonthOccurrences,
    visibleSelectedMonthOccurrences,
  };
}

function emptyMonthSummary(
  today: Date,
  language: AppLanguage,
): MoneySeriesItem {
  const locale = language === "en" ? enUS : es;

  return {
    id: toDateOnly(startOfMonth(today)),
    month: format(today, "MMM", { locale }),
    monthLong: format(today, "MMMM yyyy", { locale }),
    income: 0,
    expenses: 0,
    remaining: 0,
    savings: 0,
    shortfall: 0,
    hasRecords: true,
  };
}
