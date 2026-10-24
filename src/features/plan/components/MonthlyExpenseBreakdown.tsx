import type { PaidAmountAverage } from "@/domain/amount-history";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MonthlyExpenseOverrideInput } from "@/stores/app/store-types";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";
import { PlanEmptyTableRow } from "./PlanSectionList";

type MonthlyExpenseBreakdownProps = {
  language: AppLanguage;
  today: string;
  occurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  // Pagar sin abrir el editor (solo los pendientes).
  onTogglePaid?: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: MonthlyExpenseOverrideInput) => void;
  suggestPaidAmount?: (occurrence: ExpenseOccurrence) => PaidAmountAverage | null;
};

// Tabla de los recibos de un mes: pagar, editar (también lo pagado de
// verdad) y quitar del mes cada uno.
export function MonthlyExpenseBreakdown({
  language,
  today,
  occurrences,
  categories,
  onSkipOccurrence,
  onTogglePaid,
  onUpdateMonthlyExpense,
  suggestPaidAmount,
}: MonthlyExpenseBreakdownProps) {
  return (
    <div className="app-monthly-table" data-tone="expense">
      <div className="app-monthly-table-head app-monthly-expense-table-head">
        <span>{t("money.expenseItem", language)}</span>
        <span>{t("money.amountColumn", language)}</span>
        <span aria-hidden="true" />
      </div>
      <div className="app-monthly-table-body" data-integrated-list="true">
        {occurrences.length ? (
          occurrences.map((occurrence) => (
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
          <PlanEmptyTableRow>{t("money.noExpensesForMonth", language)}</PlanEmptyTableRow>
        )}
      </div>
    </div>
  );
}
