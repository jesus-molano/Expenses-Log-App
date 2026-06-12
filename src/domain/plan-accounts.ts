import type { PlanAccount, PlanAccountPurpose } from "./types";

export const PLAN_ACCOUNT_NAME_MAX_LENGTH = 24;

export const PLAN_ACCOUNT_PURPOSES = [
  "salary",
  "expenses",
  "daily",
  "savings",
  "investment",
  "other",
] satisfies PlanAccountPurpose[];

const planAccountPurposeSet = new Set<string>(PLAN_ACCOUNT_PURPOSES);

export function isPlanAccountPurpose(
  purpose: string,
): purpose is PlanAccountPurpose {
  return planAccountPurposeSet.has(purpose);
}

export function normalizePlanAccountName(name: string, index: number): string {
  const trimmed = name.trim().slice(0, PLAN_ACCOUNT_NAME_MAX_LENGTH);
  return trimmed || `Cuenta ${index + 1}`;
}

export function sortPlanAccountPurposes(
  purposes: PlanAccountPurpose[],
): PlanAccountPurpose[] {
  const selected = new Set(purposes);
  return PLAN_ACCOUNT_PURPOSES.filter((purpose) => selected.has(purpose));
}

export function normalizeUniquePlanAccountPurposes(
  accounts: PlanAccount[],
): PlanAccount[] {
  const assigned = new Set<PlanAccountPurpose>();

  return accounts.map((account) => ({
    ...account,
    purposes: sortPlanAccountPurposes(
      account.purposes.filter((purpose) => {
        if (assigned.has(purpose)) return false;
        assigned.add(purpose);
        return true;
      }),
    ),
  }));
}

export function planAccountLeadPurpose(
  purposes: PlanAccountPurpose[],
): PlanAccountPurpose {
  if (purposes.includes("salary")) return "salary";
  if (purposes.includes("expenses")) return "expenses";
  if (purposes.includes("daily")) return "daily";
  if (purposes.includes("savings")) return "savings";
  if (purposes.includes("investment")) return "investment";
  return "other";
}
