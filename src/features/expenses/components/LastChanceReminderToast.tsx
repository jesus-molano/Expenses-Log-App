import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";

type LastChanceReminderToastProps = {
  occurrence: ExpenseOccurrence;
  daysUntilCharge: number;
  language: AppLanguage;
  onDismiss: (occurrence: ExpenseOccurrence) => void;
};

export function LastChanceReminderToast({
  occurrence,
  daysUntilCharge,
  language,
  onDismiss,
}: LastChanceReminderToastProps) {
  return (
    <aside className="app-last-chance-toast" role="status">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-warning)_16%,transparent)] text-[var(--app-warning)]">
        <BellRing size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--app-text)]">
          {t("expenses.lastChanceReminderTitle", language)}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {occurrence.template.name} {t("expenses.lastChanceReminderBody", language)}{" "}
          {formatCurrency(occurrence.template.amount)} ·{" "}
          {daysUntilCharge === 0
            ? t("common.today", language)
            : `${daysUntilCharge} ${t("expenses.days", language)}`}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={() => onDismiss(occurrence)}
      >
        {t("expenses.lastChanceReminderDismiss", language)}
      </Button>
    </aside>
  );
}
