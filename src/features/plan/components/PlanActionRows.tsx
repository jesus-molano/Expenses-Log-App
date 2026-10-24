import { ChevronRight, Plus } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, MonthlyMoneyPlan } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import { PlanActionRow } from "./PlanActionRow";

// "Ahorro de este mes" y "Añadir ingreso extra" del mes que se mira.
export function PlanActionRows({
  plan,
  savingsLabel,
  language,
  onOpenSavings,
  onOpenExtraIncome,
}: {
  plan: Pick<MonthlyMoneyPlan, "savingsActual" | "savingsTarget" | "extraIncomeTotal">;
  // "Ahorro de este mes" o, en otro mes, "Ahorro de octubre".
  savingsLabel: string;
  language: AppLanguage;
  onOpenSavings: () => void;
  onOpenExtraIncome: () => void;
}) {
  return (
    <div className="app-plan-actions grid gap-1 rounded-[var(--app-radius-lg)] p-1">
      <button
        type="button"
        onClick={onOpenSavings}
        className="app-plan-savings-action app-focus-ring flex min-h-14 w-full items-center justify-between gap-4 rounded-[var(--app-radius-md)] px-3 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--app-text)] first-letter:uppercase">
            {savingsLabel}
          </span>
          <span className="mt-1 block text-sm text-[var(--app-text-muted)]">
            {formatMessage(
              "plan.savingsActionDetail",
              {
                actual: formatCurrency(plan.savingsActual),
                goal: formatCurrency(plan.savingsTarget),
              },
              language,
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="app-money font-semibold text-[var(--app-success)]">
            {formatCurrency(plan.savingsActual)}
          </span>
          <ChevronRight size={17} aria-hidden="true" className="text-[var(--app-text-muted)]" />
        </span>
      </button>

      <PlanActionRow
        icon={<Plus size={17} aria-hidden="true" />}
        label={t("plan.extraIncome", language)}
        detail={formatCurrency(plan.extraIncomeTotal)}
        onClick={onOpenExtraIncome}
      />
    </div>
  );
}
