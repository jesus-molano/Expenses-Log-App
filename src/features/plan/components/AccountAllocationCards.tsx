"use client";

import { Landmark, PiggyBank, WalletCards } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { MoneyCard } from "./PlanCards";

type AccountAllocationCardsProps = {
  language: AppLanguage;
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
  expensesContribution: number;
  fixedExpensesTotal: number;
  savingsContribution: number;
  monthlySavingsTarget: number;
  primaryContribution: number;
};

export function AccountAllocationCards({
  language,
  expensesAccountName,
  savingsAccountName,
  primaryAccountName,
  expensesContribution,
  fixedExpensesTotal,
  savingsContribution,
  monthlySavingsTarget,
  primaryContribution,
}: AccountAllocationCardsProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
      <MoneyCard
        icon={<WalletCards size={18} />}
        label={expensesAccountName}
        value={formatCurrency(expensesContribution)}
        detail={`${t("money.expensesPrefix", language)}: ${formatCurrency(fixedExpensesTotal)}`}
      />
      <MoneyCard
        icon={<PiggyBank size={18} />}
        label={savingsAccountName}
        value={formatCurrency(savingsContribution)}
        detail={`${t("money.targetPrefix", language)}: ${formatCurrency(monthlySavingsTarget)}`}
      />
      <MoneyCard
        icon={<Landmark size={18} />}
        label={primaryAccountName}
        value={formatCurrency(primaryContribution)}
        detail={t("money.discretionary", language)}
      />
    </div>
  );
}
