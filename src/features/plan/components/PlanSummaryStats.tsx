import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { MoneyStat } from "./MoneyStat";

type PlanSummaryStatsProps = {
  language: AppLanguage;
  incomeTotal: number;
  fixedExpensesTotal: number;
  savingsContribution: number;
  primaryContribution: number;
};

export function PlanSummaryStats({
  language,
  incomeTotal,
  fixedExpensesTotal,
  savingsContribution,
  primaryContribution,
}: PlanSummaryStatsProps) {
  return (
    <section className="grid grid-cols-2 gap-2">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(incomeTotal)}
      />
      <MoneyStat
        label={t("money.fixedExpenses", language)}
        value={formatCurrency(fixedExpensesTotal)}
      />
      <MoneyStat
        label={t("money.savings", language)}
        value={formatCurrency(savingsContribution)}
      />
      <MoneyStat
        label={t("money.free", language)}
        value={formatCurrency(primaryContribution)}
      />
    </section>
  );
}
