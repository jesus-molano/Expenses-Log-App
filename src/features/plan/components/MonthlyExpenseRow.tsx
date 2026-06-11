import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { X } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";

export function MonthlyExpenseRow({
  occurrence,
  categoryName,
  language,
  today,
  skipLabel,
  onSkip,
}: {
  occurrence: ExpenseOccurrence;
  categoryName: string;
  language: AppLanguage;
  today: string;
  skipLabel: string;
  onSkip: () => void;
}) {
  const locale = language === "en" ? enUS : es;
  const isPaid = occurrence.status === "paid";
  const isOverdue = occurrence.status !== "paid" && occurrence.dueDate < today;
  const status = isPaid
    ? t("common.paid", language)
    : isOverdue
      ? t("expenses.overdue", language)
      : t("common.pending", language);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 py-2 ring-1 ring-[var(--app-border)]">
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            isPaid
              ? "text-[var(--app-text-subtle)] line-through"
              : "text-[var(--app-text)]"
          }`}
        >
          {occurrence.template.name}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-[var(--app-text-muted)]">
          {format(new Date(`${occurrence.dueDate}T00:00:00`), "d MMM", {
            locale,
          })}{" "}
          · {categoryLabel(categoryName, language)} · {status}
        </p>
      </div>
      <p
        className={`text-sm font-semibold ${
          isPaid
            ? "text-[var(--app-text-subtle)] line-through"
            : "text-[var(--app-text)]"
        }`}
      >
        {formatCurrency(occurrence.template.amount)}
      </p>
      <button
        type="button"
        onClick={onSkip}
        aria-label={skipLabel}
        title={skipLabel}
        className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-danger)_14%,transparent)] text-[var(--app-danger)] ring-1 ring-[color-mix(in_srgb,var(--app-danger)_28%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--app-danger)_20%,transparent)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
