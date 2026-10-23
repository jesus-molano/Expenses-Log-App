import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { formatRecurringDate } from "@/features/expenses/lib/recurring-overview-format";
import { localizedRecurrenceLabel } from "@/features/expenses/lib/recurrence-label";
import type { RecurringOverviewItem } from "@/features/expenses/lib/recurring-overview";
import { RecurringStatusIcon } from "./RecurringStatusIcon";

type RecurringOverviewCardProps = {
  item: RecurringOverviewItem;
  category?: ExpenseCategory;
  language: AppLanguage;
};

export function RecurringOverviewCard({
  item,
  category,
  language,
}: RecurringOverviewCardProps) {
  return (
    <article className="grid gap-2 border-b border-[var(--app-border)] py-3 last:border-b-0">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid size-9 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
          <RecurringStatusIcon status={item.status} />
        </span>

        {/* El nombre solo comparte fila con el lapiz; el importe va debajo,
            a la derecha de la frecuencia, para no estrechar el nombre. */}
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold leading-snug text-[var(--app-text)]">
            {item.template.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="min-w-0 break-words text-xs font-medium text-[var(--app-text-muted)]">
              {localizedRecurrenceLabel(item.template.recurrence, language)}
              {category ? ` · ${categoryLabel(category.name, language)}` : ""}
            </p>
            <p className="app-money ml-auto whitespace-nowrap text-sm font-semibold text-[var(--app-text)]">
              {formatCurrency(item.template.amount)}
            </p>
          </div>
        </div>

        <Link
          href={`/expenses/${item.template.id}`}
          aria-label={t("expenses.editSeries", language)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] transition hover:text-[var(--app-accent)]"
        >
          <Pencil size={14} />
        </Link>
      </div>

      <p className="break-words pl-12 text-xs font-medium text-[var(--app-text-muted)]">
        {recurringStatusSummary(item, language)}
      </p>
    </article>
  );
}

function recurringStatusSummary(
  item: RecurringOverviewItem,
  language: AppLanguage,
) {
  if (item.overdueOccurrence) {
    return `${t("expenses.previousPending", language)}: ${formatRecurringDate(
      item.overdueOccurrence.dueDate,
      language,
    )}`;
  }

  if (item.currentOccurrence) {
    return `${t("expenses.currentMonthCharge", language)}: ${formatRecurringDate(
      item.currentOccurrence.dueDate,
      language,
    )}`;
  }

  if (item.nextOccurrence) {
    return `${t("expenses.nextCharge", language)}: ${formatRecurringDate(
      item.nextOccurrence.dueDate,
      language,
    )}`;
  }

  if (item.lastPaidOccurrence) {
    return `${t("expenses.lastPaid", language)}: ${formatRecurringDate(
      item.lastPaidOccurrence.dueDate,
      language,
    )}`;
  }

  return t("expenses.noRecurringSeries", language);
}
