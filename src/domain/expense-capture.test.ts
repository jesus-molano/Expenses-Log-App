import { describe, expect, it } from "vitest";
import {
  matchCategoryName,
  normalizeCapturedExpense,
  type CapturedExpenseItem,
} from "./expense-capture";

const today = "2026-10-23";

function item(overrides: Partial<CapturedExpenseItem>): CapturedExpenseItem {
  return {
    name: "Netflix",
    amount: 12.99,
    categoryName: "Suscripciones",
    frequency: "monthly",
    interval: null,
    unit: null,
    dueDay: 5,
    annualMonth: null,
    startDate: null,
    ...overrides,
  };
}

describe("normalizeCapturedExpense", () => {
  it("keeps a complete monthly expense as is", () => {
    expect(normalizeCapturedExpense(item({}), { today })).toEqual({
      draft: {
        name: "Netflix",
        description: "",
        amount: 12.99,
        categoryName: "Suscripciones",
        startDate: "2026-10-01",
        dueDay: 5,
        recurrence: { frequency: "monthly" },
      },
      missingFields: [],
      inferredFields: [],
    });
  });

  it("never invents an amount", () => {
    for (const amount of [null, 0, -5, Number.NaN]) {
      const result = normalizeCapturedExpense(item({ amount }), { today });
      expect(result.draft.amount).toBe(0);
      expect(result.missingFields).toEqual(["amount"]);
    }
  });

  it("maps custom month intervals to their own frequency", () => {
    const frequencyOf = (interval: number, unit: CapturedExpenseItem["unit"]) =>
      normalizeCapturedExpense(item({ frequency: "custom", interval, unit }), { today })
        .draft.recurrence;

    expect(frequencyOf(3, "month")).toEqual({ frequency: "quarterly" });
    expect(frequencyOf(1, "year")).toEqual({ frequency: "yearly", annualMonth: 10 });
    expect(frequencyOf(2, "month")).toEqual({ frequency: "custom", interval: 2, unit: "month" });
  });

  it("dates a one-off expense on its start date", () => {
    expect(
      normalizeCapturedExpense(
        item({ frequency: "once", startDate: "2026-11-15", dueDay: null }),
        { today },
      ).draft,
    ).toMatchObject({ startDate: "2026-11-15", dueDay: 15 });
    expect(
      normalizeCapturedExpense(item({ frequency: "once", dueDay: 3 }), { today }).draft,
    ).toMatchObject({ startDate: "2026-10-03", dueDay: 3 });
  });

  it("takes the yearly month from the start date and ignores impossible dates", () => {
    expect(
      normalizeCapturedExpense(
        item({ frequency: "yearly", startDate: "2027-03-10", dueDay: null }),
        { today },
      ).draft,
    ).toMatchObject({ dueDay: 10, recurrence: { frequency: "yearly", annualMonth: 3 } });

    const invalid = normalizeCapturedExpense(
      item({ startDate: "soon", dueDay: 45 }),
      { today },
    );
    expect(invalid.draft).toMatchObject({ startDate: "2026-10-01", dueDay: 23 });
    expect(invalid.inferredFields).toContain("dueDay");
  });

  it("matches categories without accents, by alias, or from the name", () => {
    expect(matchCategoryName("educación/trabajo", [])).toBe("Educacion/Trabajo");
    expect(matchCategoryName("subscriptions", [])).toBe("Suscripciones");
    expect(matchCategoryName("viajes", ["Viajes"])).toBe("Viajes");
    expect(
      normalizeCapturedExpense(item({ name: "Mercadona", categoryName: "Inventada" }), { today }),
    ).toMatchObject({
      draft: { categoryName: "Alimentacion" },
      inferredFields: ["categoryName"],
    });
  });
});
