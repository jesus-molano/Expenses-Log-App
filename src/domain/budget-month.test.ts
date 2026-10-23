import { describe, expect, it } from "vitest";
import {
  addMonthId,
  buildMonthContext,
  configuredPayday,
  isMonthClosed,
  monthCloseStatus,
  monthPendingSummary,
  paymentSettlesMonth,
  resolveActiveMonth,
  selectCarryOverOccurrences,
  shouldSuggestAdvance,
} from "./budget-month";
import { estimateChargeDate } from "./calendar";
import {
  materializeClosedOccurrenceRecords,
  occurrencesDueBetween,
} from "./finance";
import { emptyFinanceStore } from "./finance";
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

describe("active month", () => {
  const closedOctober = {
    "2026-10": {
      closedAt: "2026-10-28T10:00:00.000Z",
      updatedAt: "2026-10-28T10:00:00.000Z",
    },
  };

  it("moves one month ahead only while the calendar month is closed", () => {
    expect(resolveActiveMonth("2026-10-28", undefined)).toBe("2026-10");
    expect(resolveActiveMonth("2026-10-28", closedOctober)).toBe("2026-11");
    // El cierre de octubre deja de importar cuando llega noviembre.
    expect(resolveActiveMonth("2026-11-02", closedOctober)).toBe("2026-11");
    expect(resolveActiveMonth("2026-12-31", closedOctober)).toBe("2026-12");
  });

  it("treats a reopened month as open until it is closed again", () => {
    const reopened = {
      "2026-10": {
        ...closedOctober["2026-10"],
        reopenedAt: "2026-10-28T10:05:00.000Z",
        updatedAt: "2026-10-28T10:05:00.000Z",
      },
    };

    expect(isMonthClosed(reopened, "2026-10")).toBe(false);
    expect(resolveActiveMonth("2026-10-28", reopened)).toBe("2026-10");
  });

  it("adds months across years", () => {
    expect(addMonthId("2026-12", 1)).toBe("2027-01");
    expect(addMonthId("2026-01", -1)).toBe("2025-12");
  });
});

describe("month close suggestion", () => {
  const settled = monthCloseStatus(
    [
      occurrence("rent", 700, "2026-10-01", "paid"),
      occurrence("gym", 30, "2026-10-12", "paid"),
      occurrence("skipped", 5, "2026-10-20", "skipped"),
      occurrence("next-rent", 700, "2026-11-01", "paid"),
      occurrence("next-gym", 30, "2026-11-12"),
    ],
    "2026-10",
  );

  it("summarises the month and what is already paid of the next one", () => {
    expect(settled).toEqual({
      monthId: "2026-10",
      paidCount: 2,
      pendingCount: 0,
      pendingTotal: 0,
      nextMonthPaidCount: 1,
    });
  });

  it("suggests advancing near month end or once payday has arrived", () => {
    expect(shouldSuggestAdvance({ status: settled, today: "2026-10-21", payday: null }))
      .toBe(true);
    expect(shouldSuggestAdvance({ status: settled, today: "2026-10-20", payday: null }))
      .toBe(false);
    expect(shouldSuggestAdvance({ status: settled, today: "2026-10-15", payday: 15 }))
      .toBe(true);
  });

  it("does not suggest advancing with pending bills, an empty month or another month", () => {
    const pending = monthCloseStatus(
      [
        occurrence("rent", 700, "2026-10-01", "paid"),
        occurrence("internet", 30, "2026-10-28"),
      ],
      "2026-10",
    );
    const empty = monthCloseStatus([], "2026-10");

    expect(shouldSuggestAdvance({ status: pending, today: "2026-10-30", payday: 1 }))
      .toBe(false);
    expect(shouldSuggestAdvance({ status: empty, today: "2026-10-30", payday: 1 }))
      .toBe(false);
    expect(shouldSuggestAdvance({ status: settled, today: "2026-11-30", payday: 1 }))
      .toBe(false);
  });

  it("uses the payday only when a salary is configured", () => {
    const withSalary = {
      ...emptyFinanceStore,
      monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 31 } },
    };

    expect(configuredPayday(emptyFinanceStore, "2026-10")).toBeNull();
    expect(configuredPayday(withSalary, "2026-08")).toBeNull();
    expect(configuredPayday(withSalary, "2026-10")).toBe(31);
  });
});

describe("month context", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [template("rent", "2026-10-01", 1), template("power", "2026-10-25", 25)],
    overrides: [
      {
        id: "ovr:rent:2026-10-01",
        userId: "demo",
        templateId: "rent",
        occurrenceDate: "2026-10-01",
        status: "paid",
      },
      {
        id: "ovr:rent:2026-11-01",
        userId: "demo",
        templateId: "rent",
        occurrenceDate: "2026-11-01",
        status: "paid",
      },
    ],
  };

  it("knows the active month, what is pending and what next month already has", () => {
    const context = buildMonthContext(store, "2026-10-28");

    expect(context).toMatchObject({
      calendarMonthId: "2026-10",
      activeMonthId: "2026-10",
      nextMonthId: "2026-11",
      payday: null,
      closeStatus: { paidCount: 1, pendingCount: 1, nextMonthPaidCount: 1 },
    });
  });

  it("detects the payment that leaves the month settled", () => {
    const context = buildMonthContext(store, "2026-10-28");
    const power = occurrencesDueBetween(store, "2026-10-25", "2026-10-25").find(
      (item) => item.template.id === "power",
    )!;

    expect(paymentSettlesMonth(context, power)).toBe(true);
    expect(paymentSettlesMonth(buildMonthContext(store, "2026-10-10"), power)).toBe(
      false,
    );
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

  it("does not invent an unpaid bill in a closed month after the due day changes", () => {
    const today = new Date(2026, 10, 3, 9);
    const closed = materializeClosedOccurrenceRecords(
      {
        ...emptyStore,
        templates: [template("internet", "2026-08-28", 28)],
        overrides: [paidOverride("internet", "2026-10-28")],
      },
      { today },
    );
    const moved: ExpenseStore = {
      ...closed,
      templates: closed.templates.map((item) => ({ ...item, dueDay: 10 })),
    };

    expect(selectCarryOverOccurrences(moved, today)).toEqual([]);
    expect(
      occurrencesDueBetween(moved, "2026-10-01", "2026-10-31").map((item) => item.dueDate),
    ).toEqual(["2026-10-28"]);
  });

  it("keeps a bill paid today visible so it can be undone", () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const occurrenceDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-15`;
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [template("gym", occurrenceDate, 15)],
      overrides: [
        { ...paidOverride("gym", occurrenceDate), paidAt: now.toISOString() },
      ],
    };

    expect(
      selectCarryOverOccurrences(store, now).map((item) => item.status),
    ).toEqual(["paid"]);
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
