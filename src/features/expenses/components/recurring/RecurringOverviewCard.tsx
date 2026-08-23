import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import {
  formatRecurringDate,
  recurringFrequencyLabel,
} from "@/features/expenses/lib/recurring-overview-format";
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="grid size-9 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]">
          <RecurringStatusIcon status={item.status} />
        </span>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--app-text)]">
            {item.template.name}
          </h3>
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--app-text-muted)]">
            {recurringFrequencyLabel(item.template.recurrence, language)}
            {category ? ` · ${categoryLabel(category.name, language)}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p className="app-money text-sm font-semibold text-[var(--app-text)]">
            {formatCurrency(item.template.amount)}
          </p>
          <Link
            href={`/expenses/${item.template.id}`}
            aria-label={t("expenses.editSeries", language)}
            className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] transition hover:text-[var(--app-accent)]"
          >
            <Pencil size={14} />
          </Link>
        </div>
      </div>

      <p className="pl-12 text-xs font-medium text-[var(--app-text-muted)]">
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
