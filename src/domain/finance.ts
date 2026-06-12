import { endOfMonth, parseISO, startOfMonth } from "date-fns";
import {
  PLAN_ACCOUNT_PURPOSES,
  planAccountLeadPurpose,
} from "./plan-accounts";
import { formatCurrency, toDateOnly } from "./calendar";
import type {
  ExpenseOccurrence,
  FinanceStore,
  IncomeEvent,
  MonthlyMoneyPlan,
  MonthlySalarySettings,
  PlanAccount,
  PlanAccountPurpose,
} from "./types";

const DEFAULT_PAYDAY = 28;

export const defaultPlanAccounts: PlanAccount[] = [
  {
    id: "acct-primary",
    name: "Cuenta principal",
    purposes: ["salary", "daily"],
  },
  {
    id: "acct-expenses",
    name: "Cuenta gastos",
    purposes: ["expenses"],
  },
  {
    id: "acct-savings",
    name: "Cuenta ahorro",
    purposes: ["savings", "investment"],
  },
];

export const defaultFinanceStore: FinanceStore = {
  incomeEvents: [
    {
      id: "evt-bizum-demo",
      userId: "demo",
      name: "Bizum pendiente",
      amount: 40,
      currency: "EUR",
      receivedAt: "2026-06-10",
      note: "Extra puntual",
      createdAt: "2026-06-10T09:00:00.000Z",
      updatedAt: "2026-06-10T09:00:00.000Z",
    },
  ],
  monthlySalary: {
    "2026-06": {
      amount: 2200,
      dayOfMonth: 28,
    },
  },
  monthlySavingsTargets: {
    "2026-06": 300,
  },
  accounts: defaultPlanAccounts,
};

export const emptyFinanceStore: FinanceStore = {
  incomeEvents: [],
  monthlySalary: {},
  monthlySavingsTargets: {},
  accounts: defaultPlanAccounts,
};

export type AccountAllocation = {
  account: PlanAccount;
  assignedAmount: number;
  isConsolidated: boolean;
  leadPurpose: PlanAccountPurpose;
  showAmount: boolean;
  purposes: Array<{
    purpose: PlanAccountPurpose;
    amount: number;
    contributesAmount: boolean;
  }>;
  buckets: Array<{
    purpose: PlanAccountPurpose;
    amount: number;
  }>;
};

export function toMonthId(monthDate: Date | string | null | undefined): string {
  if (typeof monthDate === "string") {
    const trimmed = monthDate.trim();
    if (/^\d{4}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateOnly(startOfMonth(parsed)).slice(0, 7);
    }

    return toDateOnly(startOfMonth(new Date())).slice(0, 7);
  }

  if (!monthDate || Number.isNaN(monthDate.getTime())) {
    return toDateOnly(startOfMonth(new Date())).slice(0, 7);
  }

  return toDateOnly(startOfMonth(monthDate)).slice(0, 7);
}

export function getMonthlySalarySettings(
  finance: FinanceStore,
  monthDate: Date | string,
): MonthlySalarySettings {
  const monthId = toMonthId(monthDate);
  const fallback: MonthlySalarySettings = {
    amount: 0,
    dayOfMonth: DEFAULT_PAYDAY,
  };

  return latestRecordValue(finance.monthlySalary, monthId, fallback);
}

export function getMonthlySavingsTarget(
  finance: FinanceStore,
  monthDate: Date | string,
): number {
  const monthId = toMonthId(monthDate);
  return Math.max(latestRecordValue(finance.monthlySavingsTargets, monthId, 0), 0);
}

function latestRecordValue<T>(
  record: Record<string, T> | undefined,
  monthId: string,
  fallback: T,
): T {
  const candidates = Object.entries(record ?? {})
    .filter(([key]) => /^\d{4}-\d{2}$/.test(key) && key <= monthId)
    .sort(([a], [b]) => b.localeCompare(a));

  return candidates[0]?.[1] ?? fallback;
}

export function buildMonthlyMoneyPlan({
  monthDate,
  finance,
  occurrences,
}: {
  monthDate: Date;
  finance: FinanceStore;
  occurrences: ExpenseOccurrence[];
}): MonthlyMoneyPlan {
  const monthStart = toDateOnly(startOfMonth(monthDate));
  const monthEnd = toDateOnly(endOfMonth(monthDate));
  const month = monthStart.slice(0, 7);
  const salarySettings = getMonthlySalarySettings(finance, month);
  const salaryIncomeTotal = Math.max(Number(salarySettings.amount), 0);
  const monthlySavingsTarget = getMonthlySavingsTarget(finance, month);
  const extraIncomeTotal = finance.incomeEvents
    .filter((event) => event.receivedAt >= monthStart && event.receivedAt <= monthEnd)
    .reduce((sum, event) => sum + event.amount, 0);
  const incomeTotal = salaryIncomeTotal + extraIncomeTotal;
  const plannedExpensesTotal = occurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "skipped" &&
        occurrence.dueDate >= monthStart &&
        occurrence.dueDate <= monthEnd,
    )
    .reduce((sum, occurrence) => sum + occurrence.template.amount, 0);
  const expensesContribution = Math.min(incomeTotal, plannedExpensesTotal);
  const afterExpenses = incomeTotal - expensesContribution;
  const savingsContribution = Math.min(
    Math.max(afterExpenses, 0),
    monthlySavingsTarget,
  );
  const remainingContribution = Math.max(afterExpenses - savingsContribution, 0);
  const shortfall = Math.max(plannedExpensesTotal - incomeTotal, 0);

  return {
    month,
    incomeTotal,
    salaryIncomeTotal,
    extraIncomeTotal,
    plannedExpensesTotal,
    expensesContribution,
    savingsContribution,
    remainingContribution,
    investmentContribution: 0,
    shortfall,
  };
}

export function buildAccountAllocations(
  accounts: PlanAccount[],
  plan: MonthlyMoneyPlan,
): AccountAllocation[] {
  const singleAccount = accounts.length === 1;
  const sourceAccount =
    accounts.find((account) => account.purposes.includes("salary")) ??
    accounts[0];
  const bucketAmounts: Record<PlanAccountPurpose, number> = {
    salary: 0,
    expenses: plan.expensesContribution,
    daily: plan.remainingContribution,
    savings: plan.savingsContribution,
    investment: 0,
    other: 0,
  };

  function bucketDestination(purpose: PlanAccountPurpose): string | null {
    if (bucketAmounts[purpose] <= 0) return null;
    return (
      accounts.find((account) => account.purposes.includes(purpose)) ??
      sourceAccount
    )?.id ?? null;
  }

  const destinationByPurpose = new Map<PlanAccountPurpose, string>();
  PLAN_ACCOUNT_PURPOSES.forEach((purpose) => {
    const destination = bucketDestination(purpose);
    if (destination) destinationByPurpose.set(purpose, destination);
  });

  return accounts.map((account) => {
    const isConsolidated =
      singleAccount &&
      PLAN_ACCOUNT_PURPOSES.every((purpose) => account.purposes.includes(purpose));
    const buckets = PLAN_ACCOUNT_PURPOSES
      .filter((purpose) => destinationByPurpose.get(purpose) === account.id)
      .map((purpose) => ({
        purpose,
        amount: bucketAmounts[purpose],
      }));
    const assignedAmount = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
    const showAmount = !isConsolidated && !singleAccount && assignedAmount > 0;

    return {
      account,
      assignedAmount,
      buckets,
      isConsolidated,
      leadPurpose: isConsolidated
        ? "salary"
        : planAccountLeadPurpose(account.purposes),
      purposes: account.purposes.map((purpose) => ({
        purpose,
        amount: bucketAmounts[purpose],
        contributesAmount: destinationByPurpose.get(purpose) === account.id,
      })),
      showAmount,
    };
  });
}

export function accountPurposeAmount(
  purpose: PlanAccountPurpose,
  plan: MonthlyMoneyPlan,
): number {
  if (purpose === "salary") return plan.incomeTotal;
  if (purpose === "expenses") return plan.expensesContribution;
  if (purpose === "daily") return plan.remainingContribution;
  if (purpose === "savings") return plan.savingsContribution;
  if (purpose === "investment") return plan.investmentContribution;
  return 0;
}

export function financeSummaryLabel(plan: MonthlyMoneyPlan): string {
  if (plan.shortfall > 0) return `Faltan ${formatCurrency(plan.shortfall)}`;
  return `${formatCurrency(plan.remainingContribution)} restantes`;
}

export function createIncomeEvent(input: {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
}): IncomeEvent {
  const now = new Date().toISOString();
  return {
    id: `evt-${crypto.randomUUID()}`,
    userId: "demo",
    name: input.name.trim() || "Ingreso extra",
    amount: Number(input.amount),
    currency: "EUR",
    receivedAt: input.receivedAt,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateIncomeEvent(
  event: IncomeEvent,
  input: {
    name: string;
    amount: number;
    receivedAt: string;
    note?: string;
  },
): IncomeEvent {
  return {
    ...event,
    name: input.name.trim() || "Ingreso extra",
    amount: Math.max(Number(input.amount), 0),
    receivedAt: input.receivedAt,
    note: input.note?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function isEventInMonth(event: IncomeEvent, monthDate: Date): boolean {
  const date = parseISO(event.receivedAt);
  return (
    date >= startOfMonth(monthDate) &&
    date <= endOfMonth(monthDate)
  );
}
