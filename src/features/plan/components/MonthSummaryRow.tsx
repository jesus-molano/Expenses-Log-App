import { ClipboardList } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, MonthlyMoneyPlan } from "@/domain/types";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { formatMessage, t } from "@/shared/i18n";
import { PlanActionRow } from "./PlanActionRow";

// "Resumen de octubre · 12 de 12 pagados · 300 € ahorrado": abre el resumen
// del mes que se mira, con sus acciones de revisión. Se resalta cuando es el
// resumen que toca mirar (al cerrar el mes, al empezar el siguiente o en sus
// últimos días).
export function MonthSummaryRow({
  monthId,
  plan,
  highlighted,
  language,
  onOpen,
}: {
  monthId: string;
  plan: Pick<MonthlyMoneyPlan, "paidExpenseCount" | "plannedExpenseCount" | "savingsActual">;
  highlighted: boolean;
  language: AppLanguage;
  onOpen: () => void;
}) {
  return (
    <div className="app-plan-actions rounded-[var(--app-radius-lg)] p-1">
      <PlanActionRow
        icon={<ClipboardList size={17} aria-hidden="true" />}
        label={capitalize(
          formatMessage(
            "insights.summary.title",
            { month: formatMonthName(monthId, language) },
            language,
          ),
        )}
        detail={formatMessage(
          "insights.summary.promptDetail",
          {
            paid: plan.paidExpenseCount,
            total: plan.plannedExpenseCount,
            saved: formatCurrency(plan.savingsActual),
          },
          language,
        )}
        badge={
          highlighted ? (
            <span className="app-chip inline-flex px-2 py-0.5 text-xs font-semibold">
              {t("plan.summaryReady", language)}
            </span>
          ) : null
        }
        onClick={onOpen}
      />
    </div>
  );
}
