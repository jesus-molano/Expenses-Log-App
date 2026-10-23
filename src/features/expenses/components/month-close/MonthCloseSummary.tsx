import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, MonthlyMoneyPlan } from "@/domain/types";
import { t } from "@/shared/i18n";

type MonthCloseSummaryProps = {
  plan: MonthlyMoneyPlan;
  language: AppLanguage;
};

// Cómo queda el mes frente a su plan; se recalcula al resolver cada resto.
export function MonthCloseSummary({ plan, language }: MonthCloseSummaryProps) {
  const rows = [
    {
      label: t("monthClose.summaryPaid", language),
      value: t("monthClose.summaryPaidValue", language)
        .replace("{paid}", String(plan.paidExpenseCount))
        .replace("{planned}", String(plan.plannedExpenseCount))
        .replace("{amount}", formatCurrency(plan.paidExpensesTotal)),
    },
    {
      label: t("monthClose.summaryPending", language),
      value: t("monthClose.summaryPendingValue", language)
        .replace("{count}", String(plan.pendingExpenseCount))
        .replace("{amount}", formatCurrency(plan.pendingExpensesTotal)),
    },
    {
      label: t("monthClose.summaryIncome", language),
      value: formatCurrency(plan.incomeTotal),
    },
  ];

  return (
    <dl className="app-section-card grid gap-1 p-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 px-2 py-1.5"
        >
          <dt className="text-sm text-[var(--app-text-muted)]">{row.label}</dt>
          <dd className="app-money text-right text-sm font-semibold text-[var(--app-text)]">
            {row.value}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] px-2 pb-1.5 pt-2.5">
        <dt className="text-sm font-semibold text-[var(--app-text)]">
          {t("monthClose.summaryFree", language)}
        </dt>
        <dd className="app-money text-base font-semibold text-[var(--app-accent)]">
          {formatCurrency(plan.freeAccordingToPlan)}
        </dd>
      </div>
    </dl>
  );
}
