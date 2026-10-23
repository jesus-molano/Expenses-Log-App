import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OfflineLink } from "@/components/ui/OfflineLink";
import { Surface } from "@/components/ui/Surface";
import type { MonthCloseStatus } from "@/domain/budget-month";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { capitalize, formatMonthName } from "../lib/month-view";

type MonthCloseCardProps = {
  status: MonthCloseStatus;
  nextMonthId: string;
  hasPayday: boolean;
  language: AppLanguage;
  onAdvance: () => void;
  onDismiss: () => void;
  // Abre "Resumen de <mes>" antes de pasar al siguiente.
  onOpenSummary?: () => void;
};

// "Octubre al día · 12 pagados · 1 de noviembre ya pagado": propone pasar al
// mes siguiente cuando el natural no tiene nada pendiente.
export function MonthCloseCard({
  status,
  nextMonthId,
  hasPayday,
  language,
  onAdvance,
  onDismiss,
  onOpenSummary,
}: MonthCloseCardProps) {
  const month = formatMonthName(status.monthId, language);
  const nextMonth = formatMonthName(nextMonthId, language);
  const summary = [
    status.paidCount === 1
      ? t("expenses.monthPaidOne", language)
      : t("expenses.monthPaidMany", language).replace(
          "{count}",
          String(status.paidCount),
        ),
    status.nextMonthPaidCount > 0
      ? (status.nextMonthPaidCount === 1
          ? t("expenses.nextMonthPaidOne", language)
          : t("expenses.nextMonthPaidMany", language).replace(
              "{count}",
              String(status.nextMonthPaidCount),
            )
        ).replace("{month}", nextMonth)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Surface as="section" variant="section" padding="md" className="grid gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]">
          <CalendarCheck size={18} aria-hidden="true" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">
            {capitalize(t("expenses.monthSettledTitle", language).replace("{month}", month))}
          </h2>
          <p className="text-xs text-[var(--app-text-muted)]">{summary}</p>
          {!hasPayday ? (
            <OfflineLink
              href="/money"
              className="text-xs text-[var(--app-text-muted)] underline underline-offset-2"
            >
              {t("expenses.setPaydayHint", language)}
            </OfflineLink>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onAdvance}>
          {capitalize(t("expenses.advanceToMonth", language).replace("{month}", nextMonth))}
        </Button>
        {onOpenSummary ? (
          <Button variant="ghost" size="sm" onClick={onOpenSummary}>
            {t("insights.summary.open", language)}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t("expenses.notNow", language)}
        </Button>
      </div>
    </Surface>
  );
}
