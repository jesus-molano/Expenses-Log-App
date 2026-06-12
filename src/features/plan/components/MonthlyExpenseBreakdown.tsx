"use client";

import { TrendingDown } from "lucide-react";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";
import { PlanEmptyLine, PlanSectionList } from "./PlanSectionList";

type MonthlyExpenseBreakdownProps = {
  language: AppLanguage;
  today: string;
  occurrences: ExpenseOccurrence[];
  visibleOccurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  expanded: boolean;
  onToggleExpanded: () => void;
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

export function MonthlyExpenseBreakdown({
  language,
  today,
  occurrences,
  visibleOccurrences,
  categories,
  expanded,
  onToggleExpanded,
  onSkipOccurrence,
  onUpdateMonthlyExpense,
}: MonthlyExpenseBreakdownProps) {
  return (
    <PlanSectionList
      title={t("money.monthExpenses", language)}
      icon={TrendingDown}
      tone="danger"
    >
      {visibleOccurrences.length ? (
        visibleOccurrences.map((occurrence) => (
          <MonthlyExpenseRow
            key={occurrence.id}
            occurrence={occurrence}
            categories={categories}
            language={language}
            today={today}
            skipLabel={t("money.skipMonthExpense", language)}
            onSkip={() => onSkipOccurrence(occurrence)}
            onUpdate={onUpdateMonthlyExpense}
          />
        ))
      ) : (
        <PlanEmptyLine>{t("money.noExpensesForMonth", language)}</PlanEmptyLine>
      )}
      {occurrences.length > 6 ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-2 h-9 w-full rounded-2xl bg-[var(--app-panel-soft-alpha)] text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        >
          {expanded
            ? t("money.showLessExpenses", language)
            : `${t("money.showAllExpenses", language)} (${occurrences.length})`}
        </button>
      ) : null}
    </PlanSectionList>
  );
}
