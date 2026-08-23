"use client";

import { useMemo } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  generateStoreOccurrences,
  isEventInMonth,
} from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import type { MoneySeriesItem } from "../types";

export function useMoneySeries(
  store: ExpenseStore,
  language: AppLanguage,
  selectedYear: number,
  today: Date,
) {
  const moneySeries = useMemo<MoneySeriesItem[]>(() => {
    const locale = language === "en" ? enUS : es;
    const currentMonthId = toDateOnly(startOfMonth(today));

    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(selectedYear, index, 1);
      const monthOccurrences = generateStoreOccurrences(
        store,
        toDateOnly(startOfMonth(monthDate)),
        toDateOnly(endOfMonth(monthDate)),
        language,
      );
      const monthPlan = buildMonthlyMoneyPlan({
        monthDate,
        finance: store.finance,
        occurrences: monthOccurrences,
      });
      const oneOffEvents = store.finance.incomeEvents.filter((event) =>
        isEventInMonth(event, monthDate),
      );
      const monthId = toDateOnly(startOfMonth(monthDate));
      const isCurrentMonth = monthId === currentMonthId;
      const isPastOrCurrentMonth = monthId <= currentMonthId;
      const hasRecords =
        (isPastOrCurrentMonth &&
          (monthPlan.plannedExpensesTotal > 0 || oneOffEvents.length > 0)) ||
        isCurrentMonth;

      return {
        id: monthId,
        month: format(monthDate, "MMM", { locale }),
        monthLong: format(monthDate, "MMMM yyyy", { locale }),
        income: monthPlan.incomeTotal,
        expenses: monthPlan.plannedExpensesTotal,
        remaining: monthPlan.remainingContribution,
        savings: monthPlan.savingsContribution,
        shortfall: monthPlan.shortfall,
        hasRecords,
      };
    }).filter((item) => item.hasRecords);
  }, [
    language,
    selectedYear,
    store,
    today,
  ]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([today.getFullYear()]);
    for (const template of store.templates) {
      years.add(new Date(`${template.startDate}T00:00:00`).getFullYear());
    }
    for (const event of store.finance.incomeEvents) {
      years.add(new Date(`${event.receivedAt}T00:00:00`).getFullYear());
    }
    for (const override of store.overrides) {
      years.add(
        new Date(
          `${override.dueDate ?? override.occurrenceDate}T00:00:00`,
        ).getFullYear(),
      );
    }
    for (const record of store.occurrenceRecords ?? []) {
      years.add(new Date(`${record.dueDate}T00:00:00`).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [store, today]);

  return { moneySeries, availableYears };
}
