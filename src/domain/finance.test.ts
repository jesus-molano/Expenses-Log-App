import { describe, expect, it } from "vitest";
import {
  buildAccountAllocations,
  buildMonthlyMoneyPlan,
  defaultFinanceStore,
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
} from "./finance";
import { generateOccurrences } from "./recurrence";
import type { ExpenseOccurrence, MonthlyMoneyPlan, PlanAccount } from "./types";

function occurrence(
  name: string,
  amount: number,
  dueDate: string,
  status: ExpenseOccurrence["status"] = "due",
): ExpenseOccurrence {
  return {
    id: name,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "cobro",
    status,
    sortOrder: 0,
    template: {
      id: name,
      userId: "demo",
      name,
      description: "",
      amount,
      currency: "EUR",
      categoryId: "cat",
      startDate: dueDate,
      dueDay: Number(dueDate.slice(-2)),
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

const accountPlan: MonthlyMoneyPlan = {
  month: "2026-06",
  incomeTotal: 3239.16,
  salaryIncomeTotal: 2200,
  extraIncomeTotal: 1039.16,
  plannedExpensesTotal: 451.99,
  expensesContribution: 451.99,
  savingsContribution: 600,
  remainingContribution: 2187.17,
  investmentContribution: 0,
  shortfall: 0,
};

function account(
  id: string,
  purposes: PlanAccount["purposes"],
): PlanAccount {
  return {
    id,
    name: id,
    purposes,
  };
}

describe("finance", () => {
  it("allocates income to expenses, savings and main account", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: defaultFinanceStore,
      occurrences: [occurrence("Gastos de casa", 660, "2026-06-01")],
    });

    expect(plan.expensesContribution).toBe(660);
    expect(plan.savingsContribution).toBe(300);
    expect(plan.remainingContribution).toBe(1280);
  });

  it("reports shortfall when income cannot cover fixed expenses", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: {
        ...defaultFinanceStore,
        monthlySalary: {
          "2026-06": {
            amount: 500,
            dayOfMonth: 28,
          },
        },
        incomeEvents: [],
      },
      occurrences: [occurrence("Gastos de casa", 660, "2026-06-01")],
    });

    expect(plan.expensesContribution).toBe(500);
    expect(plan.shortfall).toBe(160);
    expect(plan.remainingContribution).toBe(0);
  });

  it("does not count skipped month occurrences as fixed expenses", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: defaultFinanceStore,
      occurrences: [
        occurrence("Parking", 30, "2026-06-01", "skipped"),
        occurrence("Gastos de casa", 660, "2026-06-01"),
      ],
    });

    expect(plan.plannedExpensesTotal).toBe(660);
  });

  it("includes annual expenses only in their due month", () => {
    const templates = [
      {
        id: "exp-car-insurance",
        userId: "demo",
        name: "Seguro coche",
        description: "",
        amount: 148.5,
        currency: "EUR" as const,
        categoryId: "cat",
        startDate: "2026-05-18",
        dueDay: 18,
        recurrence: { frequency: "yearly" as const, annualMonth: 5 },
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const mayPlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-05-01"),
      finance: defaultFinanceStore,
      occurrences: generateOccurrences(templates, [], "2026-05-01", "2026-05-31"),
    });
    const junePlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-01"),
      finance: defaultFinanceStore,
      occurrences: generateOccurrences(templates, [], "2026-06-01", "2026-06-30"),
    });

    expect(mayPlan.plannedExpensesTotal).toBe(148.5);
    expect(junePlan.plannedExpensesTotal).toBe(0);
  });

  it("carries salary and savings forward from the latest configured month", () => {
    const finance = {
      ...defaultFinanceStore,
      monthlySalary: {
        "2026-06": { amount: 2200, dayOfMonth: 28 },
        "2026-07": { amount: 4400, dayOfMonth: 25 },
      },
      monthlySavingsTargets: {
        "2026-06": 300,
        "2026-07": 800,
      },
    };

    expect(getMonthlySalarySettings(finance, "2026-08")).toEqual({
      amount: 4400,
      dayOfMonth: 25,
    });
    expect(getMonthlySavingsTarget(finance, "2026-08")).toBe(800);
  });

  it("does not show a duplicated amount for one consolidated account", () => {
    const [allocation] = buildAccountAllocations(
      [
        account("Sabadell", [
          "salary",
          "expenses",
          "daily",
          "savings",
          "investment",
          "other",
        ]),
      ],
      accountPlan,
    );

    expect(allocation.isConsolidated).toBe(true);
    expect(allocation.showAmount).toBe(false);
    expect(allocation.assignedAmount).toBeCloseTo(accountPlan.incomeTotal);
  });

  it("subtracts savings from the salary account when savings has its own destination", () => {
    const allocations = buildAccountAllocations(
      [
        account("Nomina", ["salary", "expenses", "daily"]),
        account("Ahorro", ["savings"]),
      ],
      accountPlan,
    );

    expect(allocations.find((item) => item.account.id === "Nomina"))
      .toMatchObject({
        assignedAmount:
          accountPlan.expensesContribution + accountPlan.remainingContribution,
        showAmount: true,
      });
    expect(allocations.find((item) => item.account.id === "Ahorro"))
      .toMatchObject({
        assignedAmount: accountPlan.savingsContribution,
        showAmount: true,
      });
  });

  it("assigns planned expenses only to the expenses account", () => {
    const allocations = buildAccountAllocations(
      [
        account("Nomina", ["salary", "daily", "savings"]),
        account("Gastos", ["expenses"]),
      ],
      accountPlan,
    );

    expect(allocations.find((item) => item.account.id === "Gastos"))
      .toMatchObject({
        assignedAmount: accountPlan.expensesContribution,
        showAmount: true,
      });
  });

  it("keeps investment and other as tags without amounts", () => {
    const allocations = buildAccountAllocations(
      [
        account("Nomina", ["salary", "expenses", "daily", "savings"]),
        account("Inversion", ["investment", "other"]),
      ],
      accountPlan,
    );

    expect(allocations.find((item) => item.account.id === "Inversion"))
      .toMatchObject({
        assignedAmount: 0,
        showAmount: false,
      });
  });
});
