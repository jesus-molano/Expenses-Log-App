import { formatCurrency } from "@/domain/calendar";
import { paidAmountOf } from "@/domain/finance";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { categoryToneClass, statusLabel } from "../../lib/expense-actions";
import { expenseStatusToneClass } from "../../lib/expense-visual-state";

type ExpenseRowContentProps = {
  occurrence: ExpenseOccurrence;
  category?: ExpenseCategory;
  today: string;
  language: AppLanguage;
};

export function ExpenseRowContent({
  occurrence,
  category,
  today,
  language,
}: ExpenseRowContentProps) {
  const paid = occurrence.status === "paid";
  const statusToneClass = expenseStatusToneClass(occurrence, today);
  // Pagado con otro importe: se ve lo pagado y, debajo del nombre, lo previsto.
  const amount = paid ? paidAmountOf(occurrence) : occurrence.template.amount;
  const differsFromPlan = paid && amount !== occurrence.template.amount;

  return (
    <>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`min-w-0 truncate text-[15px] font-semibold ${
              paid ? "app-row-paid" : "text-[var(--app-text)]"
            }`}
          >
            {occurrence.template.name}
          </span>
          {category ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryToneClass(
                category.tone,
              )}`}
            >
              {categoryLabel(category.name, language)}
            </span>
          ) : null}
        </div>
        {differsFromPlan ? (
          <p className="app-money mt-0.5 truncate text-xs text-[var(--app-text-muted)]">
            {t("bills.plannedHint", language).replace(
              "{amount}",
              formatCurrency(occurrence.template.amount),
            )}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`app-money text-[14px] font-semibold ${
            paid ? "app-row-paid" : "text-[var(--app-text)]"
          }`}
        >
          {formatCurrency(amount)}
        </p>
        <p
          className={`mt-1 inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusToneClass}`}
        >
          {statusLabel(occurrence, today, language)}
        </p>
      </div>
    </>
  );
}
