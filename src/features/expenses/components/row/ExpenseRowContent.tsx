import { formatCurrency } from "@/domain/calendar";
import { paidAmount } from "@/domain/finance";
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
  // Pagado con otro importe: se ve lo pagado y, junto a la categoría, lo previsto.
  const amount = paid ? paidAmount(occurrence) : occurrence.template.amount;
  const differsFromPlan = paid && amount !== occurrence.template.amount;

  // Todo se lee completo y alineado. Arriba, el nombre (salta de linea si no
  // cabe) y el importe a la derecha. Debajo, la categoria y el estado: el
  // estado va a la derecha y, si no caben los dos en la misma linea, baja a la
  // siguiente. Asi la categoria usa todo el ancho de la tarjeta, en vez de
  // partirse en una columna cuyo ancho dependia del texto del estado.
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-3">
        <span
          className={`min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug ${
            paid ? "app-row-paid" : "text-[var(--app-text)]"
          }`}
        >
          {occurrence.template.name}
        </span>
        <p
          className={`app-money shrink-0 whitespace-nowrap text-[14px] font-semibold ${
            paid ? "app-row-paid" : "text-[var(--app-text)]"
          }`}
        >
          {formatCurrency(amount)}
        </p>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {category ? (
          <span
            className={`app-expense-row-category min-w-0 max-w-full break-words px-2 py-0.5 text-[11px] font-medium leading-tight ${categoryToneClass(
              category.tone,
            )}`}
          >
            {categoryLabel(category.name, language)}
          </span>
        ) : null}
        {differsFromPlan ? (
          <span className="app-money whitespace-nowrap text-[11px] text-[var(--app-text-muted)]">
            {t("bills.plannedHint", language).replace(
              "{amount}",
              formatCurrency(occurrence.template.amount),
            )}
          </span>
        ) : null}
        <p
          className={`ml-auto inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusToneClass}`}
        >
          {statusLabel(occurrence, today, language)}
        </p>
      </div>
    </div>
  );
}
