import { describe, expect, it } from "vitest";
import {
  monthPendingSummary,
  selectCarryOverOccurrences,
} from "./budget-month";
import { estimateChargeDate } from "./calendar";
import {
  materializeClosedOccurrenceRecords,
  occurrencesDueBetween,
} from "./finance";
import { emptyStore } from "./seed";
import type {
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
} from "./types";

describe("monthPendingSummary", () => {
  it("counts only unpaid bills due in the month and flags weekend spill", () => {
    const summary = monthPendingSummary(
      [
        occurrence("saturday", 40, "2026-10-31"),
        occurrence("internet", 30, "2026-10-28"),
        occurrence("rent", 700, "2026-10-01", "paid"),
        occurrence("next-month", 15, "2026-11-01"),
      ],
      "2026-10",
    );

    expect(summary.total).toBe(70);
    expect(summary.count).toBe(2);
    expect(summary.spillToNextMonthTotal).toBe(40);
  });
});

describe("occurrencesDueBetween", () => {
  it("counts a bill in the month of its effective due date", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        template("moved-in", "2026-11-03", 3),
        template("moved-out", "2026-10-20", 20),
        template("regular", "2026-10-10", 10),
      ],
      overrides: [
        moveOverride("moved-in", "2026-11-03", "2026-10-30"),
        moveOverride("moved-out", "2026-10-20", "2026-11-15"),
      ],
    };

    const october = occurrencesDueBetween(store, "2026-10-01", "2026-10-31");
    const november = occurrencesDueBetween(store, "2026-11-01", "2026-11-30");

    expect(october.map((item) => [item.id, item.dueDate])).toEqual([
      ["regular:2026-10-10", "2026-10-10"],
      ["moved-in:2026-11-03", "2026-10-30"],
    ]);
    expect(november.map((item) => [item.id, item.dueDate])).toEqual([
      ["regular:2026-11-10", "2026-11-10"],
      ["moved-out:2026-10-20", "2026-11-15"],
      ["moved-out:2026-11-20", "2026-11-20"],
    ]);
  });
});

describe("selectCarryOverOccurrences", () => {
  it("returns only last month's unpaid bills", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        template("internet", "2026-08-28", 28),
        template("rent", "2026-08-05", 5),
      ],
      overrides: [
        paidOverride("rent", "2026-10-05"),
        moveOverride("internet", "2026-10-28", "2026-10-28", "skipped"),
      ],
    };

    const carryOver = selectCarryOverOccurrences(
      store,
      new Date(2026, 10, 1, 9),
    );

    expect(carryOver).toEqual([]);

    const withUnpaid = selectCarryOverOccurrences(
      { ...store, overrides: [paidOverride("rent", "2026-10-05")] },
      new Date(2026, 10, 1, 9),
    );
    expect(withUnpaid.map((item) => item.dueDate)).toEqual(["2026-10-28"]);
  });

  it("does not bring back bills whose expense was deleted", () => {
    const withHistory = materializeClosedOccurrenceRecords(
      {
        ...emptyStore,
        templates: [template("game-pass", "2026-10-12", 12)],
      },
      { today: new Date(2026, 10, 1, 9) },
    );
    const deleted: ExpenseStore = { ...withHistory, templates: [] };

    expect(withHistory.occurrenceRecords).toHaveLength(1);
    expect(
      selectCarryOverOccurrences(withHistory, new Date(2026, 10, 1, 9)),
    ).toHaveLength(1);
    expect(
      selectCarryOverOccurrences(deleted, new Date(2026, 10, 1, 9)),
    ).toEqual([]);
  });
});

function occurrence(
  id: string,
  amount: number,
  dueDate: string,
  status: ExpenseOccurrence["status"] = "due",
): ExpenseOccurrence {
  const estimate = estimateChargeDate(dueDate);
  return {
    id,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: estimate.date,
    estimatedChargeLabel: estimate.label,
    status,
    sortOrder: 0,
    template: template(id, dueDate, Number(dueDate.slice(-2)), amount),
  };
}

function template(
  id: string,
  startDate: string,
  dueDay: number,
  amount = 100,
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "home",
    startDate,
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function moveOverride(
  templateId: string,
  occurrenceDate: string,
  dueDate: string,
  status: ExpenseOccurrenceOverride["status"] = "due",
): ExpenseOccurrenceOverride {
  return {
    id: `${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    dueDate,
    status,
  };
}

function paidOverride(
  templateId: string,
  occurrenceDate: string,
): ExpenseOccurrenceOverride {
  return {
    id: `${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}
