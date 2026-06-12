import { TrendingDown } from "lucide-react";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";
import { PlanEmptyTableRow, PlanSectionList } from "./PlanSectionList";

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
    categoryId?: string;
    categoryName?: string;
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
      <div className="app-monthly-table" data-tone="expense">
        <div className="app-monthly-table-head">
          <span>{t("money.expenseItem", language)}</span>
          <span>{t("money.amountColumn", language)}</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
        <div className="app-monthly-table-body" data-integrated-list="true">
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
            <PlanEmptyTableRow>
              {t("money.noExpensesForMonth", language)}
            </PlanEmptyTableRow>
          )}
        </div>
        {occurrences.length > 6 ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="app-monthly-table-more"
          >
            {expanded
              ? t("money.showLessExpenses", language)
              : `${t("money.showAllExpenses", language)} (${occurrences.length})`}
          </button>
        ) : null}
      </div>
    </PlanSectionList>
  );
}
