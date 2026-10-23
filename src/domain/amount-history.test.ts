import { describe, expect, it } from "vitest";
import {
  averagePaidAmount,
  buildChargeHistory,
  buildPriceHistory,
  suggestedPaidAmount,
} from "./amount-history";
import { materializeClosedOccurrenceRecords } from "./finance";
import { emptyStore } from "./seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
} from "./types";

const electricity: ExpenseTemplate = {
  id: "luz",
  userId: "demo",
  name: "Luz",
  description: "",
  amount: 60,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-05-08",
  dueDay: 8,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

function paid(occurrenceDate: string, amountPaid?: number): ExpenseOccurrenceOverride {
  return {
    id: `ovr:luz:${occurrenceDate}`,
    userId: "demo",
    templateId: "luz",
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    amountPaid,
    updatedAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

function storeWith(
  overrides: ExpenseOccurrenceOverride[],
  template: ExpenseTemplate = electricity,
): ExpenseStore {
  return { ...emptyStore, templates: [template], overrides };
}

describe("variable bills", () => {
  const store = storeWith([
    paid("2026-06-08", 58.1),
    paid("2026-07-08", 71.2),
    paid("2026-08-08", 66.4),
    paid("2026-09-08", 74.3),
  ]);

  it("suggests the average of the last three payments before the charge", () => {
    expect(suggestedPaidAmount(store, "luz", "2026-10-08")).toEqual({
      amount: 70.63,
      count: 3,
    });
    // No cuenta el propio cobro ni los posteriores.
    expect(suggestedPaidAmount(store, "luz", "2026-09-08")).toEqual({
      amount: 65.23,
      count: 3,
    });
  });

  it("averages fewer payments when there is less history, and none without it", () => {
    expect(suggestedPaidAmount(store, "luz", "2026-07-08")).toEqual({ amount: 58.1, count: 1 });
    expect(suggestedPaidAmount(store, "luz", "2026-06-08")).toBeNull();
  });

  it("counts a payment without an amount as the planned one and ignores skipped charges", () => {
    const mixed = storeWith([
      paid("2026-06-08"),
      { ...paid("2026-07-08"), status: "skipped", paidAt: undefined },
      paid("2026-08-08", 80),
    ]);

    expect(suggestedPaidAmount(mixed, "luz", "2026-10-08")).toEqual({ amount: 70, count: 2 });
  });

  it("uses the paid amounts kept in closed-month records", () => {
    const recorded = materializeClosedOccurrenceRecords(store, {
      today: new Date("2026-10-10T10:00:00"),
    });
    const withoutOverrides = { ...recorded, overrides: [] };

    expect(suggestedPaidAmount(withoutOverrides, "luz", "2026-10-08")).toEqual({
      amount: 70.63,
      count: 3,
    });
  });

  it("averages the most recent paid occurrences only", () => {
    expect(averagePaidAmount([])).toBeNull();
  });

  it("lists planned against paid for the latest charges, newest first", () => {
    const history = buildChargeHistory(
      storeWith([paid("2026-08-08", 66.4), paid("2026-09-08", 60), paid("2026-11-08", 61)]),
      "luz",
      "2026-10-23",
      { limit: 4 },
    );

    expect(
      history.map((entry) => [
        entry.occurrence.occurrenceDate,
        entry.occurrence.status,
        entry.planned,
        entry.paid,
        entry.difference,
      ]),
    ).toEqual([
      // El de noviembre ya está pagado por adelantado.
      ["2026-11-08", "paid", 60, 61, 1],
      ["2026-10-08", "due", 60, null, 0],
      ["2026-09-08", "paid", 60, 60, 0],
      ["2026-08-08", "paid", 60, 66.4, 6.4],
    ]);
  });
});

describe("price history", () => {
  it("groups consecutive charges with the same planned amount, newest first", () => {
    const store = storeWith([], {
      ...electricity,
      amount: 10,
      startDate: "2026-01-08",
      amountChanges: [
        { from: "2026-04-01", amount: 12 },
        { from: "2026-12-01", amount: 15 },
      ],
    });

    expect(buildPriceHistory(store, "luz", "2026-10-23")).toEqual([
      { from: "2026-04-08", to: "2026-10-08", amount: 12 },
      { from: "2026-01-08", to: "2026-03-08", amount: 10 },
    ]);
  });

  it("shows a one-off planned amount and leaves skipped charges out", () => {
    const store = storeWith([
      {
        id: "ovr:luz:2026-07-08",
        userId: "demo",
        templateId: "luz",
        occurrenceDate: "2026-07-08",
        status: "due",
        amount: 70,
      },
      {
        id: "ovr:luz:2026-08-08",
        userId: "demo",
        templateId: "luz",
        occurrenceDate: "2026-08-08",
        status: "skipped",
      },
    ]);

    expect(buildPriceHistory(store, "luz", "2026-10-23")).toEqual([
      { from: "2026-09-08", to: "2026-10-08", amount: 60 },
      { from: "2026-07-08", to: "2026-07-08", amount: 70 },
      { from: "2026-05-08", to: "2026-06-08", amount: 60 },
    ]);
  });
});
