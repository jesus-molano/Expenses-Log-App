"use client";

import { useMemo, useState } from "react";
import { startOfMonth } from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import { useAnnualPlanSummary } from "./use-annual-plan-summary";
import { useCompactChart } from "./use-compact-chart";
import { useCurrentMonthPlan } from "./use-current-month-plan";
import { useMoneySeries } from "./use-money-series";
import { useMonthlyComparisonData } from "./use-monthly-comparison-data";

export function useMoneyDashboardData(
  store: ExpenseStore,
  language: AppLanguage,
) {
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    toDateOnly(startOfMonth(new Date())),
  );
  const [selectedExpensesExpanded, setSelectedExpensesExpanded] = useState(false);
  const currentMonth = useCurrentMonthPlan(store, today);
  const { moneySeries, availableYears } = useMoneySeries(
    store,
    language,
    selectedYear,
    today,
  );
  const comparison = useMonthlyComparisonData({
    store,
    language,
    moneySeries,
    today,
    selectedMonth,
    selectedExpensesExpanded,
  });
  const annual = useAnnualPlanSummary(store, today);
  const isCompactChart = useCompactChart();

  function selectYear(year: number) {
    setSelectedYear(year);
    setSelectedMonth(`${year}-01-01`);
  }

  function selectMonth(monthId: string) {
    setSelectedMonth(monthId);
    setSelectedExpensesExpanded(false);
  }

  return {
    today,
    todayDateOnly: toDateOnly(today),
    plan: currentMonth.plan,
    moneySeries,
    availableYears,
    selectedYear,
    selectedMonthSummary: comparison.selectedMonthSummary,
    selectedMonthIncomeEvents: comparison.selectedMonthIncomeEvents,
    selectedMonthOccurrences: comparison.selectedMonthOccurrences,
    visibleSelectedMonthOccurrences:
      comparison.visibleSelectedMonthOccurrences,
    selectedExpensesExpanded,
    annualExpensesTotal: annual.annualExpensesTotal,
    annualExpensesTotalLabel: annual.annualExpensesTotalLabel,
    annualSavingsEstimate: annual.annualSavingsEstimate,
    annualSavingsEstimateLabel: annual.annualSavingsEstimateLabel,
    monthlyIncomeEvents: currentMonth.monthlyIncomeEvents,
    isCompactChart,
    selectYear,
    selectMonth,
    setSelectedExpensesExpanded,
  };
}

export type MoneyDashboardData = ReturnType<typeof useMoneyDashboardData>;
export type MoneyOccurrenceAction = (occurrence: ExpenseOccurrence) => void;
