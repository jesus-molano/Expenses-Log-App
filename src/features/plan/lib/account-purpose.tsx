import {
  CircleEllipsis,
  Landmark,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { AppLanguage, PlanAccountPurpose } from "@/domain/types";
import { planAccountLeadPurpose } from "@/domain/plan-accounts";
export {
  PLAN_ACCOUNT_NAME_MAX_LENGTH,
  PLAN_ACCOUNT_PURPOSES,
} from "@/domain/plan-accounts";

const purposeIcons: Record<PlanAccountPurpose, LucideIcon> = {
  salary: Landmark,
  expenses: WalletCards,
  daily: ShoppingBag,
  savings: PiggyBank,
  investment: TrendingUp,
  other: CircleEllipsis,
};

const purposeLabels: Record<AppLanguage, Record<PlanAccountPurpose, string>> = {
  es: {
    salary: "Nomina",
    expenses: "Gastos",
    daily: "Diario",
    savings: "Ahorro",
    investment: "Inversion",
    other: "Otros",
  },
  en: {
    salary: "Salary",
    expenses: "Expenses",
    daily: "Daily",
    savings: "Savings",
    investment: "Investment",
    other: "Other",
  },
};

export function accountPurposeLabel(
  purpose: PlanAccountPurpose,
  language: AppLanguage,
) {
  return purposeLabels[language][purpose];
}

export function AccountPurposeIcon({
  purpose,
  size = 15,
}: {
  purpose: PlanAccountPurpose;
  size?: number;
}) {
  const Icon = purposeIcons[purpose];
  return <Icon size={size} />;
}

export function accountIconPurpose(
  purposes: PlanAccountPurpose[],
): PlanAccountPurpose {
  return planAccountLeadPurpose(purposes);
}
