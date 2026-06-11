import { describe, expect, it } from "vitest";
import { buildMonthlyMoneyPlan, defaultFinanceStore } from "./finance";
import { generateOccurrences } from "./recurrence";
import type { ExpenseOccurrence } from "./types";

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
      tags: [],
      startDate: dueDate,
      dueDay: Number(dueDate.slice(-2)),
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
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
    expect(plan.primaryContribution).toBe(1280);
  });

  it("reports shortfall when income cannot cover fixed expenses", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: {
        ...defaultFinanceStore,
        incomeSources: [{ ...defaultFinanceStore.incomeSources[0], amount: 500 }],
        incomeEvents: [],
      },
      occurrences: [occurrence("Gastos de casa", 660, "2026-06-01")],
    });

    expect(plan.expensesContribution).toBe(500);
    expect(plan.shortfall).toBe(160);
    expect(plan.primaryContribution).toBe(0);
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

    expect(plan.fixedExpensesTotal).toBe(660);
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
        tags: ["anual"],
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

    expect(mayPlan.fixedExpensesTotal).toBe(148.5);
    expect(junePlan.fixedExpensesTotal).toBe(0);
  });
});
