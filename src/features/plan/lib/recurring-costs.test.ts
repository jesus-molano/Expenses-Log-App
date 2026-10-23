import { describe, expect, it } from "vitest";
import type { BudgetCycle } from "@/domain/budget-cycle";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseCategory,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";
import {
  buildRecurringCostInsights,
  costWindow,
  isLongCycleRule,
} from "./recurring-costs";

describe("isLongCycleRule", () => {
  it("flags what is paid less often than once a month", () => {
    const cases: Array<[RecurrenceRule, boolean]> = [
      [{ frequency: "monthly" }, false],
      [{ frequency: "monthly", interval: 2 }, true],
      [{ frequency: "quarterly" }, true],
      [{ frequency: "yearly" }, true],
      [{ frequency: "once" }, false],
      [{ frequency: "rrule", rrule: "FREQ=YEARLY" }, false],
      [{ frequency: "custom", unit: "month", interval: 1 }, false],
      [{ frequency: "custom", unit: "month", interval: 6 }, true],
      [{ frequency: "custom", unit: "year", interval: 1 }, true],
      [{ frequency: "custom", unit: "week", interval: 4 }, false],
      [{ frequency: "custom", unit: "week", interval: 5 }, true],
      [{ frequency: "custom", unit: "day", interval: 31 }, false],
      [{ frequency: "custom", unit: "day", interval: 45 }, true],
    ];

    for (const [rule, expected] of cases) {
      expect(isLongCycleRule(rule)).toBe(expected);
    }
  });
});

describe("costWindow", () => {
  it("covers twelve budget months from the given one", () => {
    expect(costWindow("2026-11")).toEqual({ start: "2026-11-01", end: "2027-10-31" });
    const payday: BudgetCycle = {
      anchor: "payday",
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
    };
    expect(costWindow("2026-11", payday)).toEqual({ start: "2026-10-28", end: "2027-10-27" });
  });
});

describe("buildRecurringCostInsights", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    categories: [
      category("home", "Casa", "green"),
      category("subs", "Suscripciones", "violet"),
      category("car", "Vehiculo", "orange"),
    ],
    templates: [
      template("rent", "home", 700, "2026-01-01", 1),
      template("netflix", "subs", 12.99, "2026-01-15", 15),
      template("insurance", "car", 300, "2026-03-20", 20, {
        frequency: "yearly",
        annualMonth: 3,
      }),
      template("ibi", "home", 150, "2026-01-10", 10, { frequency: "quarterly" }),
      template("laptop", "home", 900, "2026-12-05", 5, { frequency: "once" }),
      { ...template("paused", "subs", 50, "2026-01-01", 1), active: false },
    ],
    overrides: [
      paid("rent", "2026-11-01", 710),
      skipped("netflix", "2026-12-15"),
    ],
    finance: {
      ...emptyStore.finance,
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
    },
  };

  it("adds up the next twelve months by category and expense", () => {
    const insights = buildRecurringCostInsights(store, { monthId: "2026-11" });

    expect(insights.range).toEqual({ start: "2026-11-01", end: "2027-10-31" });
    // Alquiler: 710 pagado + 11 × 700; IBI: 4 × 150; Netflix: 11 × 12,99
    // (uno quitado); seguro anual: 300. El portátil es un pago único.
    expect(insights.categories.map((item) => [item.categoryId, item.annual, item.monthly])).toEqual([
      ["home", 9010, 750.83],
      ["car", 300, 25],
      ["subs", 142.89, 11.91],
    ]);
    expect(insights.categories[0].expenses).toEqual([
      { templateId: "rent", name: "rent", annual: 8410, monthly: 700.83, charges: 12 },
      { templateId: "ibi", name: "ibi", annual: 600, monthly: 50, charges: 4 },
    ]);
    expect(insights.annualTotal).toBe(9452.89);
    expect(insights.monthlyAverage).toBe(787.74);
    expect(insights.salaryShare).toBeCloseTo(0.39387, 5);
    expect(insights.categories[0].share).toBeCloseTo(9010 / 9452.89, 6);
    expect(insights.categories[0].category?.name).toBe("Casa");
  });

  it("leaves out deleted expenses and works without salary", () => {
    const insights = buildRecurringCostInsights(
      {
        ...store,
        templates: store.templates.filter((item) => item.id !== "rent"),
        finance: emptyStore.finance,
      },
      { monthId: "2026-11" },
    );

    expect(insights.categories.map((item) => item.categoryId)).toEqual(["home", "car", "subs"]);
    expect(insights.annualTotal).toBe(1042.89);
    expect(insights.salaryShare).toBeNull();
  });

  it("returns an empty summary for an empty store", () => {
    expect(buildRecurringCostInsights(emptyStore, { monthId: "2026-11" })).toMatchObject({
      annualTotal: 0,
      monthlyAverage: 0,
      salaryShare: null,
      categories: [],
    });
  });
});

function category(
  id: string,
  name: string,
  tone: ExpenseCategory["tone"],
): ExpenseCategory {
  return { id, userId: "demo", name, icon: "Home", tone };
}

function template(
  id: string,
  categoryId: string,
  amount: number,
  startDate: string,
  dueDay: number,
  recurrence: RecurrenceRule = { frequency: "monthly" },
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId,
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function paid(
  templateId: string,
  occurrenceDate: string,
  amountPaid: number,
): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    amountPaid,
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

function skipped(templateId: string, occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "skipped",
  };
}
