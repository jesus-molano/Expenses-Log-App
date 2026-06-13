import { describe, expect, it } from "vitest";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { buildAnnualPlanSummary } from "./annual-plan-summary";

describe("annual plan summary", () => {
  it("estimates expenses and savings from the first month with data", () => {
    const summary = buildAnnualPlanSummary({
      store: storeWith({
        templates: [template("home", 100, "2026-05-01")],
        monthlySavingsTargets: {
          "2026-05": 600,
          "2026-06": 800,
        },
      }),
      selectedYear: 2026,
      today: new Date("2026-06-11T00:00:00"),
    });

    expect(summary.firstMonthId).toBe("2026-05");
    expect(summary.annualExpensesTotal).toBe(800);
    expect(summary.annualSavingsEstimate).toBe(5600);
  });

  it("returns zero when the selected year has no records", () => {
    const summary = buildAnnualPlanSummary({
      store: storeWith({
        templates: [template("home", 100, "2026-05-01")],
        monthlySavingsTargets: {
          "2026-05": 600,
        },
      }),
      selectedYear: 2025,
      today: new Date("2026-06-11T00:00:00"),
    });

    expect(summary.firstMonthId).toBeNull();
    expect(summary.annualExpensesTotal).toBe(0);
    expect(summary.annualSavingsEstimate).toBe(0);
  });
});

function storeWith({
  templates,
  monthlySavingsTargets,
}: {
  templates: ExpenseTemplate[];
  monthlySavingsTargets: Record<string, number>;
}): ExpenseStore {
  return {
    categories: [],
    templates,
    overrides: [],
    finance: {
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets,
      accounts: [],
    },
    bankMovements: [],
    bankMerchantAliases: [],
    preferences: {
      theme: "dark",
      language: "es",
    },
  };
}

function template(
  id: string,
  amount: number,
  startDate: string,
): ExpenseTemplate {
  return {
    id,
    userId: "user",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate,
    dueDay: Number(startDate.slice(-2)),
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}
