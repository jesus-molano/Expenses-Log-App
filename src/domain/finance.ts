import { endOfMonth, parseISO, startOfMonth } from "date-fns";
import { formatCurrency, toDateOnly } from "./calendar";
import type {
  ExpenseOccurrence,
  FinanceStore,
  IncomeEvent,
  IncomeSource,
  MonthlyMoneyPlan,
} from "./types";

export const defaultFinanceStore: FinanceStore = {
  incomeSources: [
    {
      id: "inc-salary",
      userId: "demo",
      name: "Sueldo",
      amount: 2200,
      currency: "EUR",
      dayOfMonth: 28,
      active: true,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    },
  ],
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
  allocation: {
    expensesAccountName: "Cuenta gastos",
    savingsAccountName: "Cuenta ahorro",
    primaryAccountName: "Cuenta principal",
    monthlySavingsTarget: 300,
  },
};

export const emptyFinanceStore: FinanceStore = {
  incomeSources: [],
  incomeEvents: [],
  allocation: {
    expensesAccountName: "Cuenta gastos",
    savingsAccountName: "Cuenta ahorro",
    primaryAccountName: "Cuenta principal",
    monthlySavingsTarget: 0,
  },
};

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
  const recurringIncomeTotal = finance.incomeSources
    .filter((source) => source.active)
    .reduce((sum, source) => sum + source.amount, 0);
  const extraIncomeTotal = finance.incomeEvents
    .filter((event) => event.receivedAt >= monthStart && event.receivedAt <= monthEnd)
    .reduce((sum, event) => sum + event.amount, 0);
  const incomeTotal = recurringIncomeTotal + extraIncomeTotal;
  const fixedExpensesTotal = occurrences
    .filter((occurrence) => occurrence.dueDate >= monthStart && occurrence.dueDate <= monthEnd)
    .reduce((sum, occurrence) => sum + occurrence.template.amount, 0);
  const expensesContribution = Math.min(incomeTotal, fixedExpensesTotal);
  const afterExpenses = incomeTotal - expensesContribution;
  const savingsContribution = Math.min(
    Math.max(afterExpenses, 0),
    finance.allocation.monthlySavingsTarget,
  );
  const primaryContribution = Math.max(
    afterExpenses - savingsContribution,
    0,
  );
  const shortfall = Math.max(fixedExpensesTotal - incomeTotal, 0);

  return {
    month,
    incomeTotal,
    recurringIncomeTotal,
    extraIncomeTotal,
    fixedExpensesTotal,
    expensesContribution,
    savingsContribution,
    primaryContribution,
    shortfall,
  };
}

export function financeSummaryLabel(plan: MonthlyMoneyPlan): string {
  if (plan.shortfall > 0) return `Faltan ${formatCurrency(plan.shortfall)}`;
  return `${formatCurrency(plan.primaryContribution)} libres`;
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

export function updateSalarySource(
  sources: IncomeSource[],
  amount: number,
  dayOfMonth: number,
): IncomeSource[] {
  const now = new Date().toISOString();
  const existing = sources.find((source) => source.id === "inc-salary");
  const salary: IncomeSource = {
    id: existing?.id ?? "inc-salary",
    userId: "demo",
    name: "Sueldo",
    amount: Number(amount),
    currency: "EUR",
    dayOfMonth: Math.min(Math.max(Number(dayOfMonth), 1), 31),
    active: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return [salary, ...sources.filter((source) => source.id !== salary.id)];
}

export function isEventInMonth(event: IncomeEvent, monthDate: Date): boolean {
  const date = parseISO(event.receivedAt);
  return (
    date >= startOfMonth(monthDate) &&
    date <= endOfMonth(monthDate)
  );
}
