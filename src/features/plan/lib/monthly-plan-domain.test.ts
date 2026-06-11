import { describe, expect, it } from "vitest";
import { buildMonthlyMoneyPlan } from "@/domain/finance";
import { generateOccurrences } from "@/domain/recurrence";
import type {
  ExpenseOccurrenceOverride,
  ExpenseTemplate,
  FinanceStore,
} from "@/domain/types";

const finance: FinanceStore = {
  incomeSources: [
    {
      id: "salary",
      userId: "user",
      name: "Sueldo",
      amount: 2000,
      currency: "EUR",
      dayOfMonth: 25,
      active: true,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  incomeEvents: [
    {
      id: "bizum-may",
      userId: "user",
      name: "Bizum",
      amount: 40,
      currency: "EUR",
      receivedAt: "2026-05-10",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    },
  ],
  allocation: {
    expensesAccountName: "Gastos",
    savingsAccountName: "Ahorro",
    primaryAccountName: "Principal",
    monthlySavingsTarget: 300,
  },
};

const templates: ExpenseTemplate[] = [
  template("home", "Gastos de casa", 660, "2026-05-01", 1, {
    frequency: "monthly",
  }),
  template("insurance", "Seguro coche", 300, "2026-05-05", 5, {
    frequency: "yearly",
    annualMonth: 5,
  }),
];

const overrides: ExpenseOccurrenceOverride[] = [
  {
    id: "skip-home-june",
    userId: "user",
    templateId: "home",
    occurrenceDate: "2026-06-01",
    status: "skipped",
  },
];

describe("monthly plan domain behavior", () => {
  it("includes annual expenses only in their real month", () => {
    const mayOccurrences = generateOccurrences(
      templates,
      [],
      "2026-05-01",
      "2026-05-31",
    );
    const juneOccurrences = generateOccurrences(
      templates,
      [],
      "2026-06-01",
      "2026-06-30",
    );

    expect(mayOccurrences.map((item) => item.template.name)).toContain(
      "Seguro coche",
    );
    expect(juneOccurrences.map((item) => item.template.name)).not.toContain(
      "Seguro coche",
    );
  });

  it("counts one-off income only in its month and skips skipped occurrences", () => {
    const mayPlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-05-10T00:00:00"),
      finance,
      occurrences: generateOccurrences(
        templates,
        [],
        "2026-05-01",
        "2026-05-31",
      ),
    });
    const junePlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10T00:00:00"),
      finance,
      occurrences: generateOccurrences(
        templates,
        overrides,
        "2026-06-01",
        "2026-06-30",
      ),
    });

    expect(mayPlan.extraIncomeTotal).toBe(40);
    expect(mayPlan.fixedExpensesTotal).toBe(960);
    expect(junePlan.extraIncomeTotal).toBe(0);
    expect(junePlan.fixedExpensesTotal).toBe(0);
  });
});

function template(
  id: string,
  name: string,
  amount: number,
  startDate: string,
  dueDay: number,
  recurrence: ExpenseTemplate["recurrence"],
): ExpenseTemplate {
  return {
    id,
    userId: "user",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    tags: [],
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}
