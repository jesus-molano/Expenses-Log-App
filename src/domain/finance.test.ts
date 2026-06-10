import { describe, expect, it } from "vitest";
import { buildMonthlyMoneyPlan, defaultFinanceStore } from "./finance";
import type { ExpenseOccurrence } from "./types";

function occurrence(name: string, amount: number, dueDate: string): ExpenseOccurrence {
  return {
    id: name,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "cobro",
    status: "due",
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

    expect(plan.sabadellContribution).toBe(660);
    expect(plan.bbvaSavingsContribution).toBe(300);
    expect(plan.bbvaMainContribution).toBe(1280);
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

    expect(plan.sabadellContribution).toBe(500);
    expect(plan.shortfall).toBe(160);
    expect(plan.bbvaMainContribution).toBe(0);
  });
});
