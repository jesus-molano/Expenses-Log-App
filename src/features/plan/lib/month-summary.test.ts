import { describe, expect, it } from "vitest";
import type { BudgetCycle } from "@/domain/budget-cycle";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";
import { buildMonthSummary, summaryPromptMonth } from "./month-summary";

describe("buildMonthSummary", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [
      template("rent", 700, "2026-01-01", 1),
      template("power", 60, "2026-01-08", 8),
      template("ibi", 150, "2026-01-10", 10, { frequency: "quarterly" }),
      template("gym", 30, "2026-10-12", 12),
      template("netflix", 12.99, "2026-01-15", 15),
    ],
    overrides: [
      paid("rent", "2026-09-01"),
      paid("power", "2026-09-08", 55),
      paid("rent", "2026-10-01"),
      paid("power", "2026-10-08", 71.2),
      paid("ibi", "2026-10-10"),
      skipped("netflix", "2026-10-15"),
    ],
    finance: {
      ...emptyStore.finance,
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
      monthlySavingsTargets: { "2026-01": { amount: 300, updatedAt: "2026-01-01T00:00:00.000Z" } },
      monthlySavingsContributions: {
        "2026-10": {
          id: "saving:2026-10",
          userId: "demo",
          monthId: "2026-10",
          amount: 250,
          source: "manual",
          createdAt: "2026-10-28T10:00:00.000Z",
          updatedAt: "2026-10-28T10:00:00.000Z",
        },
      },
    },
  };

  it("sums what was planned, paid, left and saved", () => {
    const summary = buildMonthSummary(store, "2026-10", { today: new Date(2026, 9, 29, 10) });

    expect(summary).toMatchObject({
      monthId: "2026-10",
      previousMonthId: "2026-09",
      // Alquiler, luz, IBI y gimnasio; Netflix quitado.
      plannedCount: 4,
      plannedTotal: 940,
      paidCount: 3,
      paidTotal: 921.2,
      pendingCount: 1,
      pendingTotal: 30,
      skippedCount: 1,
      incomeTotal: 2000,
      savingsActual: 250,
      savingsTarget: 300,
    });
    expect(summary.deltas).toEqual({ planned: 167.01, paid: 166.2, savings: 250 });
  });

  it("lists the biggest changes against the previous month", () => {
    const summary = buildMonthSummary(store, "2026-10", { today: new Date(2026, 9, 29, 10) });

    expect(summary.changes.map((change) => [change.templateId, change.kind, change.delta])).toEqual([
      ["ibi", "new", 150],
      ["gym", "new", 30],
      ["power", "up", 16.2],
      ["netflix", "gone", -12.99],
    ]);
    expect(summary.changes[2]).toMatchObject({ amount: 71.2, previousAmount: 55 });
  });

  it("is empty for a month without bills", () => {
    expect(
      buildMonthSummary(emptyStore, "2026-10", { today: new Date(2026, 9, 29, 10) }),
    ).toMatchObject({ plannedCount: 0, plannedTotal: 0, changes: [] });
  });
});

describe("summaryPromptMonth", () => {
  it("offers the month that was just closed", () => {
    expect(
      summaryPromptMonth({ today: "2026-10-28", calendarMonthId: "2026-10", activeMonthId: "2026-11" }),
    ).toBe("2026-10");
  });

  it("offers the previous month during the first week and the current one at the end", () => {
    const prompt = (today: string) =>
      summaryPromptMonth({ today, calendarMonthId: today.slice(0, 7), activeMonthId: today.slice(0, 7) });

    expect(prompt("2026-11-01")).toBe("2026-10");
    expect(prompt("2026-11-07")).toBe("2026-10");
    expect(prompt("2026-11-08")).toBeNull();
    expect(prompt("2026-11-27")).toBeNull();
    expect(prompt("2026-11-28")).toBe("2026-11");
    expect(prompt("2026-11-30")).toBe("2026-11");
  });

  it("follows the payday cycle", () => {
    const cycle: BudgetCycle = {
      anchor: "payday",
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
    };

    // Noviembre (28 oct - 27 nov) acaba de empezar: se ofrece octubre.
    expect(
      summaryPromptMonth({ today: "2026-10-29", calendarMonthId: "2026-11", activeMonthId: "2026-11", cycle }),
    ).toBe("2026-10");
    expect(
      summaryPromptMonth({ today: "2026-11-26", calendarMonthId: "2026-11", activeMonthId: "2026-11", cycle }),
    ).toBe("2026-11");
  });
});

function template(
  id: string,
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
    categoryId: "cat",
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
  amountPaid?: number,
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
