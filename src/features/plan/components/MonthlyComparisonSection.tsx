"use client";

import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
  IncomeEvent,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MonthlyComparisonSelectors } from "./MonthlyComparisonSelectors";
import { MonthlyComparisonStats } from "./MonthlyComparisonStats";
import { MonthlyExpenseBreakdown } from "./MonthlyExpenseBreakdown";
import { MonthlyIncomeEventsList } from "./MonthlyIncomeEventsList";
import { PlanEmptyLine } from "./PlanSectionList";

type MonthlyComparisonSectionProps = {
  language: AppLanguage;
  today: string;
  moneySeries: MoneySeriesItem[];
  availableYears: number[];
  selectedYear: number;
  selectedMonthSummary: MoneySeriesItem;
  selectedMonthIsPast: boolean;
  yearMenuOpen: boolean;
  monthMenuOpen: boolean;
  incomeEvents: IncomeEvent[];
  occurrences: ExpenseOccurrence[];
  visibleOccurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  expanded: boolean;
  onYearOpenChange: (open: boolean) => void;
  onMonthOpenChange: (open: boolean) => void;
  onSelectYear: (year: number) => void;
  onSelectMonth: (monthId: string) => void;
  onToggleExpanded: () => void;
  onEditSavings: () => void;
  onDeleteIncomeEvent: (id: string) => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
};

export function MonthlyComparisonSection({
  language,
  today,
  moneySeries,
  availableYears,
  selectedYear,
  selectedMonthSummary,
  selectedMonthIsPast,
  yearMenuOpen,
  monthMenuOpen,
  incomeEvents,
  occurrences,
  visibleOccurrences,
  categories,
  expanded,
  onYearOpenChange,
  onMonthOpenChange,
  onSelectYear,
  onSelectMonth,
  onToggleExpanded,
  onEditSavings,
  onDeleteIncomeEvent,
  onSkipOccurrence,
}: MonthlyComparisonSectionProps) {
  return (
    <div className="mt-4 rounded-[1.15rem] border border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-soft-alpha)_72%,transparent)] p-3">
      <header>
        <h3 className="text-sm font-semibold text-[var(--app-text)]">
          {t("money.compareMonths", language)}
        </h3>
        <p className="mt-0.5 text-xs font-medium capitalize text-[var(--app-text-muted)]">
          {selectedMonthSummary.monthLong}
        </p>
      </header>

      <MonthlyComparisonSelectors
        language={language}
        moneySeries={moneySeries}
        availableYears={availableYears}
        selectedYear={selectedYear}
        selectedMonthSummary={selectedMonthSummary}
        yearMenuOpen={yearMenuOpen}
        monthMenuOpen={monthMenuOpen}
        onYearOpenChange={onYearOpenChange}
        onMonthOpenChange={onMonthOpenChange}
        onSelectYear={onSelectYear}
        onSelectMonth={onSelectMonth}
      />

      {!moneySeries.length ? (
        <PlanEmptyLine>{t("money.noMonthsWithData", language)}</PlanEmptyLine>
      ) : null}

      <MonthlyComparisonStats
        language={language}
        summary={selectedMonthSummary}
        canEditSavings={selectedMonthIsPast}
        onEditSavings={onEditSavings}
      />

      <MonthlyIncomeEventsList
        language={language}
        incomeEvents={incomeEvents}
        onDeleteIncomeEvent={onDeleteIncomeEvent}
      />

      <MonthlyExpenseBreakdown
        language={language}
        today={today}
        occurrences={occurrences}
        visibleOccurrences={visibleOccurrences}
        categories={categories}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        onSkipOccurrence={onSkipOccurrence}
      />
    </div>
  );
}
