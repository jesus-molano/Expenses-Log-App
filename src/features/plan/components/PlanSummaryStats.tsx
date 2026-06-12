import { CircleDollarSign, PiggyBank, ReceiptText, Wallet } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { MoneyStat } from "./MoneyStat";
import type { MoneyStatTone } from "./MoneyStat";

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
  const remainingTone: MoneyStatTone =
    remainingContribution > 0
      ? "success"
      : remainingContribution < 0
        ? "danger"
        : "neutral";

  return (
    <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(incomeTotal)}
        icon={<CircleDollarSign />}
        tone="info"
      />
      <MoneyStat
        label={t("money.fixedExpenses", language)}
        value={formatCurrency(plannedExpensesTotal)}
        icon={<ReceiptText />}
        tone="expense"
      />
      <MoneyStat
        label={t("money.savings", language)}
        value={formatCurrency(savingsContribution)}
        icon={<PiggyBank />}
        tone="success"
      />
      <MoneyStat
        label={t("money.free", language)}
        value={formatCurrency(remainingContribution)}
        icon={<Wallet />}
        tone={remainingTone}
      />
    </section>
  );
}
