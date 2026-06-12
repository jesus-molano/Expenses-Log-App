import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { MoneyStat } from "./MoneyStat";

type PlanSummaryStatsProps = {
  language: AppLanguage;
  incomeTotal: number;
  plannedExpensesTotal: number;
  savingsContribution: number;
  remainingContribution: number;
};

export function PlanSummaryStats({
  language,
  incomeTotal,
  plannedExpensesTotal,
  savingsContribution,
  remainingContribution,
}: PlanSummaryStatsProps) {
  return (
    <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(incomeTotal)}
      />
      <MoneyStat
        label={t("money.fixedExpenses", language)}
        value={formatCurrency(plannedExpensesTotal)}
      />
      <MoneyStat
        label={t("money.savings", language)}
        value={formatCurrency(savingsContribution)}
      />
      <MoneyStat
        label={t("money.free", language)}
        value={formatCurrency(remainingContribution)}
      />
    </section>
  );
}
