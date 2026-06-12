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
  onEditSalary: () => void;
  onEditSavings: () => void;
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (
    id: string,
    input: { name: string; amount: number; receivedAt: string; note?: string },
  ) => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: {
    templateId: string;
    occurrenceDate: string;
    dueDate: string;
    name: string;
    amount: number;
    categoryId: string;
    status: ExpenseOccurrence["status"];
  }) => void;
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
  onEditSalary,
  onEditSavings,
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
  onSkipOccurrence,
  onUpdateMonthlyExpense,
}: MonthlyComparisonSectionProps) {
  return (
    <section className="min-w-0">
      <header className="px-1">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">
            {t("money.compareMonths", language)}
          </h2>
          <p className="mt-1 text-sm font-medium capitalize text-[var(--app-text-muted)]">
            {selectedMonthSummary.monthLong}
          </p>
        </div>
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
        canEditSalary={selectedMonthIsPast}
        canEditSavings={selectedMonthIsPast}
        onEditSalary={onEditSalary}
        onEditSavings={onEditSavings}
      />

      <MonthlyIncomeEventsList
        language={language}
        incomeEvents={incomeEvents}
        onDeleteIncomeEvent={onDeleteIncomeEvent}
        onUpdateIncomeEvent={onUpdateIncomeEvent}
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
        onUpdateMonthlyExpense={onUpdateMonthlyExpense}
      />
    </section>
  );
}
