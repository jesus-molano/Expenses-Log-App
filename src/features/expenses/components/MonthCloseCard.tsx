import { CalendarCheck, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OfflineLink } from "@/components/ui/OfflineLink";
import { Surface } from "@/components/ui/Surface";
import type { MonthCloseStatus } from "@/domain/budget-month";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { capitalize, formatMonthName } from "../lib/month-view";

type MonthCloseCardProps = {
  status: MonthCloseStatus;
  nextMonthId: string;
  hasPayday: boolean;
  language: AppLanguage;
  // "settled": nada pendiente, se pasa de mes directamente. "leftovers": tras
  // el cobro quedan recibos y se abre la hoja de cierre.
  variant?: "settled" | "leftovers";
  onAdvance: () => void;
  onReview?: () => void;
  onDismiss: () => void;
  // Abre "Resumen de <mes>" antes de pasar al siguiente.
  onOpenSummary?: () => void;
};

// "Octubre al día · 12 pagados · 1 de noviembre ya pagado": propone pasar al
// mes siguiente cuando el natural no tiene nada pendiente. Si quedan recibos
// tras el cobro, "Cierre de octubre · Quedan 2 recibos" abre la hoja de cierre.
export function MonthCloseCard({
  status,
  nextMonthId,
  hasPayday,
  language,
  variant = "settled",
  onAdvance,
  onReview,
  onDismiss,
  onOpenSummary,
}: MonthCloseCardProps) {
  const month = formatMonthName(status.monthId, language);
  const nextMonth = formatMonthName(nextMonthId, language);
  const leftovers = variant === "leftovers";
  const paidSummary =
    status.paidCount === 1
      ? t("expenses.monthPaidOne", language)
      : t("expenses.monthPaidMany", language).replace(
          "{count}",
          String(status.paidCount),
        );
  const summary = [
    leftovers
      ? (status.pendingCount === 1
          ? t("monthClose.cardLeftoversOne", language)
          : t("monthClose.cardLeftoversMany", language).replace(
              "{count}",
              String(status.pendingCount),
            )
        ).replace("{total}", formatCurrency(status.pendingTotal))
      : null,
    status.paidCount > 0 || !leftovers ? paidSummary : null,
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
  const Icon = leftovers ? CalendarClock : CalendarCheck;

  return (
    <Surface as="section" variant="section" padding="md" className="grid gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            leftovers
              ? "bg-[color-mix(in_srgb,var(--app-warning)_16%,transparent)] text-[var(--app-warning)]"
              : "bg-[color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]"
          }`}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">
            {capitalize(
              t(leftovers ? "monthClose.cardTitle" : "expenses.monthSettledTitle", language)
                .replace("{month}", month),
            )}
          </h2>
          <p className="text-xs text-[var(--app-text-muted)]">{summary}</p>
          {!hasPayday && !leftovers ? (
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
        {leftovers ? (
          <Button variant="primary" size="sm" onClick={onReview}>
            {capitalize(t("monthClose.closeMonth", language).replace("{month}", month))}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onAdvance}>
            {capitalize(t("expenses.advanceToMonth", language).replace("{month}", nextMonth))}
          </Button>
        )}
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
