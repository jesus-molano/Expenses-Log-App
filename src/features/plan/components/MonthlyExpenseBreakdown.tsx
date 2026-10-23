import { TrendingDown } from "lucide-react";
import type { PaidAmountAverage } from "@/domain/amount-history";
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
  // Pagar desde la revisión sin abrir el editor (solo los pendientes).
  onTogglePaid?: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: {
    templateId: string;
    occurrenceDate: string;
    dueDate: string;
    name: string;
    amount: number;
    categoryId?: string;
    categoryName?: string;
    status: ExpenseOccurrence["status"];
    amountPaid?: number;
  }) => void;
  suggestPaidAmount?: (occurrence: ExpenseOccurrence) => PaidAmountAverage | null;
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
  onTogglePaid,
  onUpdateMonthlyExpense,
  suggestPaidAmount,
}: MonthlyExpenseBreakdownProps) {
  return (
    <PlanSectionList
      title={t("money.monthExpenses", language)}
      icon={TrendingDown}
      tone="danger"
    >
      <div className="app-monthly-table" data-tone="expense">
        <div className="app-monthly-table-head app-monthly-expense-table-head">
          <span>{t("money.expenseItem", language)}</span>
          <span>{t("money.amountColumn", language)}</span>
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
                onTogglePaid={
                  onTogglePaid && occurrence.status === "due"
                    ? () => onTogglePaid(occurrence)
                    : undefined
                }
                onUpdate={onUpdateMonthlyExpense}
                suggestPaidAmount={suggestPaidAmount}
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
