import { CalendarClock } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, MonthlyMoneyPlan } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatShortDate } from "../lib/plan-dashboard";

// "Próximo recibo" (o el vencido más antiguo) del mes que se mira.
export function NextReceiptCard({
  plan,
  language,
}: {
  plan: Pick<MonthlyMoneyPlan, "nextPending" | "plannedExpenseCount">;
  language: AppLanguage;
}) {
  const next = plan.nextPending;

  return (
    <div className="app-plan-next-receipt flex min-h-11 items-center gap-3 px-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
        <CalendarClock size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {next ? (
          <>
            <p className="break-words text-sm font-semibold text-[var(--app-text)]">
              {next.overdue ? t("plan.overdue", language) : t("plan.nextReceipt", language)}:{" "}
              {next.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
              <span className="app-money">
                {formatShortDate(next.dueDate, language)} · {formatCurrency(next.amount)}
              </span>
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-[var(--app-success)]">
            {plan.plannedExpenseCount
              ? t("plan.allPaid", language)
              : t("plan.noUpcomingReceipt", language)}
          </p>
        )}
      </div>
    </div>
  );
}
