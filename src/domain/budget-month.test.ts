import { describe, expect, it } from "vitest";
import {
  addMonthId,
  buildMonthContext,
  buildMonthPlan,
  buildPaydayOutlook,
  canMoveOccurrence,
  configuredPayday,
  defaultDateInMonth,
  getNextPayday,
  isMonthClosed,
  monthCloseStatus,
  monthPendingSummary,
  occurrenceMoveRange,
  paymentSettlesMonth,
  resolveActiveMonth,
  selectCarryOverOccurrences,
  shouldSuggestAdvance,
  shouldSuggestCloseWithLeftovers,
} from "./budget-month";
import { resolveBudgetCycle } from "./budget-cycle";
import { estimateChargeDate } from "./calendar";
import {
  materializeClosedOccurrenceRecords,
  occurrencesDueBetween,
} from "./finance";
import { emptyFinanceStore } from "./finance";
import {
  closeMonthInStore,
  reopenMonthInStore,
} from "@/stores/app/finance-commands";
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

  it("summarises the month", () => {
    expect(settled).toEqual({
      monthId: "2026-10",
      paidCount: 2,
      pendingCount: 0,
      pendingTotal: 0,
      leftovers: [],
    });
  });

  it("clamps a payday beyond the end of a short month", () => {
    const november = monthCloseStatus(
      [occurrence("rent", 700, "2026-11-01", "paid")],
      "2026-11",
    );

    // Día de cobro 31: en noviembre se cobra el 30.
    expect(shouldSuggestAdvance({ status: november, today: "2026-11-15", payday: 31 }))
      .toBe(false);
    expect(
      shouldSuggestAdvance({
        status: { ...november, monthId: "2026-11" },
        today: "2026-11-30",
        payday: 31,
      }),
    ).toBe(true);
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

describe("closing a month with leftovers", () => {
  const withLeftovers = monthCloseStatus(
    [
      occurrence("rent", 700, "2026-10-01", "paid"),
      occurrence("internet", 30, "2026-10-20"),
      occurrence("gym", 45, "2026-10-30"),
    ],
    "2026-10",
  );

  it("lists what is still pending in the month", () => {
    expect(withLeftovers.leftovers.map((item) => item.id)).toEqual(["internet", "gym"]);
    expect(withLeftovers.pendingTotal).toBe(75);
  });

  it("suggests closing once payday arrives near the end of the month", () => {
    const suggest = (today: string, payday: number | null) =>
      shouldSuggestCloseWithLeftovers({ status: withLeftovers, today, payday });

    expect(suggest("2026-10-27", 28)).toBe(false);
    expect(suggest("2026-10-28", 28)).toBe(true);
    // Quien cobra a primeros financia ese mes: el cobro no cierra el anterior.
    expect(suggest("2026-10-10", 5)).toBe(false);
    // Sin cobro, en los últimos días del mes.
    expect(suggest("2026-10-28", null)).toBe(false);
    expect(suggest("2026-10-29", null)).toBe(true);
  });

  it("does not suggest it with nothing pending or for another month", () => {
    const settledStatus = monthCloseStatus(
      [occurrence("rent", 700, "2026-10-01", "paid")],
      "2026-10",
    );

    expect(
      shouldSuggestCloseWithLeftovers({ status: settledStatus, today: "2026-10-30", payday: 28 }),
    ).toBe(false);
    expect(
      shouldSuggestCloseWithLeftovers({ status: withLeftovers, today: "2026-11-02", payday: 1 }),
    ).toBe(false);
  });
});

describe("until payday", () => {
  const salary = (dayOfMonth: number, from = "2026-09") => ({
    ...emptyFinanceStore,
    monthlySalary: { [from]: { amount: 2000, dayOfMonth } },
  });

  it("finds the next payday after today, clamped to the month", () => {
    expect(getNextPayday(salary(28), "2026-10-23")).toBe("2026-10-28");
    // El día de cobro ya cuenta como cobrado: el siguiente es el del mes que viene.
    expect(getNextPayday(salary(28), "2026-10-28")).toBe("2026-11-28");
    expect(getNextPayday(salary(31), "2026-11-02")).toBe("2026-11-30");
    expect(getNextPayday(salary(28, "2026-11"), "2026-10-23")).toBe("2026-11-28");
    expect(getNextPayday(emptyFinanceStore, "2026-10-23")).toBeNull();
  });

  it("adds what is still unpaid before payday, overdue bills included", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      finance: salary(28),
      templates: [
        template("old", "2026-09-15", 15, 20),
        template("internet", "2026-10-20", 20, 30),
        template("gym", "2026-10-24", 24, 45),
        template("weekend", "2026-10-31", 31, 10),
        template("rent", "2026-11-01", 1, 700),
      ],
      overrides: [
        paidOverride("old", "2026-10-15"),
        paidOverride("gym", "2026-10-24"),
        paidOverride("rent", "2026-11-01"),
      ],
    };

    const outlook = buildPaydayOutlook(store, "2026-10-23");

    // Septiembre sin pagar, internet atrasado; el gimnasio ya está pagado.
    expect(outlook).toMatchObject({ payday: "2026-10-28", daysUntil: 5, total: 50 });
    expect(outlook?.items.map((item) => item.id)).toEqual([
      "old:2026-09-15",
      "internet:2026-10-20",
    ]);

    // Tras el cobro del 28 cuenta hasta el 28 de noviembre. El sábado 31 se
    // carga el lunes 2 y el alquiler de noviembre ya está pagado.
    const afterPayday = buildPaydayOutlook(store, "2026-10-28");
    expect(afterPayday).toMatchObject({ payday: "2026-11-28", daysUntil: 31 });
    expect(afterPayday?.items.map((item) => item.id)).toEqual([
      "old:2026-09-15",
      "internet:2026-10-20",
      "weekend:2026-10-31",
      "old:2026-11-15",
      "internet:2026-11-20",
      "gym:2026-11-24",
    ]);
  });

  it("needs a configured salary", () => {
    expect(buildPaydayOutlook(emptyStore, "2026-10-23")).toBeNull();
  });
});

describe("months as seen from another month", () => {
  it("dates an entry today, on the 1st of a future month or the last day of a past one", () => {
    expect(defaultDateInMonth("2026-10", "2026-10-23")).toBe("2026-10-23");
    expect(defaultDateInMonth("2026-11", "2026-10-23")).toBe("2026-11-01");
    expect(defaultDateInMonth("2026-09", "2026-10-23")).toBe("2026-09-30");
  });

  it("builds the plan of a month with its phase against the active month", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [template("rent", "2026-10-01", 1, 700)],
      finance: {
        ...emptyFinanceStore,
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-28T10:00:00.000Z",
            updatedAt: "2026-10-28T10:00:00.000Z",
          },
        },
      },
    };

    expect(buildMonthPlan(store, "2026-11", { today: "2026-10-28" })).toMatchObject({
      month: "2026-11",
      phase: "current",
      plannedExpensesTotal: 700,
    });
    expect(buildMonthPlan(store, "2026-10", { today: "2026-10-28" }).phase).toBe("registered");
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
      closeStatus: { paidCount: 1, pendingCount: 1 },
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

describe("carry-over for a viewed month", () => {
  it("does not pull bills that are not due yet into a future month", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [template("internet", "2026-10-25", 25), template("old", "2026-10-02", 2)],
    };

    const carried = selectCarryOverOccurrences(
      store,
      new Date(2026, 9, 23, 12),
      "es",
      "2026-11",
    );

    expect(carried.map((item) => item.template.id)).toEqual(["old"]);
  });
});

describe("closing and reopening with a slow clock", () => {
  it("keeps every change after the previous one", () => {
    const closed = closeMonthInStore(emptyStore, "2026-10", new Date("2026-10-28T10:00:00.000Z"));
    // Otro dispositivo con el reloj 5 minutos atrasado reabre.
    const reopened = reopenMonthInStore(closed, "2026-10", new Date("2026-10-28T09:57:00.000Z"));

    expect(isMonthClosed(reopened.finance.monthClosures, "2026-10")).toBe(false);
    expect(
      reopened.finance.monthClosures!["2026-10"].updatedAt >
        closed.finance.monthClosures!["2026-10"].updatedAt,
    ).toBe(true);

    const closedAgain = closeMonthInStore(reopened, "2026-10", new Date("2026-10-28T09:58:00.000Z"));
    expect(isMonthClosed(closedAgain.finance.monthClosures, "2026-10")).toBe(true);
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

describe("payday-anchored budget month", () => {
  // Cobro el 28: "noviembre" va del 28 de octubre al 27 de noviembre.
  const finance = {
    ...emptyFinanceStore,
    monthlySalary: {
      "2026-09": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-09-01T00:00:00.000Z" },
    },
    budgetCycle: { anchor: "payday" as const, updatedAt: "2026-10-01T00:00:00.000Z" },
  };
  const base: ExpenseStore = {
    ...emptyStore,
    finance,
    templates: [
      template("rent", "2026-09-01", 1),
      template("internet", "2026-09-29", 29),
      template("gym", "2026-09-12", 12),
    ],
  };
  const cycle = resolveBudgetCycle(finance);
  const allPaidNovember: ExpenseStore = {
    ...base,
    overrides: [
      paidOverride("internet", "2026-10-29"),
      paidOverride("rent", "2026-11-01"),
      paidOverride("gym", "2026-11-12"),
      paidOverride("rent", "2026-12-01"),
    ],
  };

  it("puts today in the cycle that started on the last payday", () => {
    expect(buildMonthContext(base, "2026-10-27")).toMatchObject({
      calendarMonthId: "2026-10",
      activeMonthId: "2026-10",
      nextMonthId: "2026-11",
    });
    expect(buildMonthContext(base, "2026-10-28")).toMatchObject({
      calendarMonthId: "2026-11",
      activeMonthId: "2026-11",
      nextMonthId: "2026-12",
      payday: 28,
    });
  });

  it("counts the bills of the cycle, including the ones before the 1st", () => {
    const context = buildMonthContext(base, "2026-10-29");
    const { leftovers, ...counts } = context.closeStatus;

    expect(counts).toEqual({
      monthId: "2026-11",
      paidCount: 0,
      pendingCount: 3,
      pendingTotal: 300,
    });
    // Los restos del cierre son los mismos días del ciclo.
    expect(leftovers.map((item) => item.id).sort()).toEqual([
      "gym:2026-11-12",
      "internet:2026-10-29",
      "rent:2026-11-01",
    ]);
    expect(buildMonthContext(allPaidNovember, "2026-10-29").closeStatus).toMatchObject({
      paidCount: 3,
      pendingCount: 0,
    });
  });

  it("suggests advancing near the end of the cycle, not on payday", () => {
    const status = buildMonthContext(allPaidNovember, "2026-10-29").closeStatus;

    expect(shouldSuggestAdvance({ status, today: "2026-10-29", payday: 28, cycle })).toBe(false);
    expect(shouldSuggestAdvance({ status, today: "2026-11-16", payday: 28, cycle })).toBe(false);
    expect(shouldSuggestAdvance({ status, today: "2026-11-17", payday: 28, cycle })).toBe(true);
    // El 28 de noviembre ya es diciembre: el estado de noviembre no aplica.
    expect(shouldSuggestAdvance({ status, today: "2026-11-28", payday: 28, cycle })).toBe(false);
  });

  it("keeps the next cycle active until the calendar reaches it", () => {
    const closures = {
      "2026-11": { closedAt: "2026-11-20T10:00:00.000Z", updatedAt: "2026-11-20T10:00:00.000Z" },
    };

    expect(resolveActiveMonth("2026-11-20", closures, cycle)).toBe("2026-12");
    expect(resolveActiveMonth("2026-11-28", closures, cycle)).toBe("2026-12");
    expect(resolveActiveMonth("2026-11-20", closures)).toBe("2026-12");
    expect(resolveActiveMonth("2026-12-28", closures, cycle)).toBe("2027-01");
  });

  it("carries over what the previous cycle left unpaid", () => {
    const store: ExpenseStore = {
      ...base,
      overrides: [paidOverride("rent", "2026-10-01"), paidOverride("internet", "2026-09-29")],
    };

    const carried = selectCarryOverOccurrences(
      store,
      new Date(2026, 9, 29, 9),
      "es",
      "2026-11",
      cycle,
    );

    // El ciclo anterior va del 28 de septiembre al 27 de octubre.
    expect(carried.map((item) => item.id)).toEqual(["gym:2026-10-12"]);
  });

  it("detects the payment that settles the cycle", () => {
    const store: ExpenseStore = {
      ...allPaidNovember,
      overrides: allPaidNovember.overrides.filter(
        (override) => override.id !== "gym:2026-11-12",
      ),
    };
    const gym = occurrencesDueBetween(store, "2026-11-12", "2026-11-12").find(
      (item) => item.template.id === "gym",
    )!;

    expect(paymentSettlesMonth(buildMonthContext(store, "2026-11-20"), gym)).toBe(true);
    expect(paymentSettlesMonth(buildMonthContext(store, "2026-11-10"), gym)).toBe(false);
  });

  it("offers closing with leftovers in the last days of the cycle, not on payday", () => {
    const status = buildMonthContext(base, "2026-10-29").closeStatus;
    const suggest = (today: string) =>
      shouldSuggestCloseWithLeftovers({ status, today, payday: 28, cycle });

    expect(suggest("2026-11-24")).toBe(false);
    expect(suggest("2026-11-25")).toBe(true);
    // El 28 de noviembre ya es diciembre: el estado de noviembre no aplica.
    expect(suggest("2026-11-28")).toBe(false);
  });

  it("builds the cycle's plan and dates entries inside its days", () => {
    expect(defaultDateInMonth("2026-11", "2026-10-20", cycle)).toBe("2026-10-28");
    expect(defaultDateInMonth("2026-11", "2026-10-29", cycle)).toBe("2026-10-29");
    expect(buildMonthPlan(base, "2026-11", { today: "2026-10-29" })).toMatchObject({
      month: "2026-11",
      phase: "current",
      // Internet del 29 de octubre, alquiler del 1 y gimnasio del 12 de noviembre.
      plannedExpensesTotal: 300,
    });
  });

  it("splits pending totals by the cycle's days", () => {
    const occurrences = [
      occurrence("before", 40, "2026-10-27"),
      occurrence("first-day", 30, "2026-10-28"),
      occurrence("last-day", 20, "2026-11-27"),
      occurrence("after", 10, "2026-11-28"),
    ];

    expect(monthCloseStatus(occurrences, "2026-11", cycle)).toMatchObject({
      pendingCount: 2,
      pendingTotal: 50,
    });
    expect(monthCloseStatus(occurrences, "2026-11")).toMatchObject({
      pendingCount: 2,
      pendingTotal: 30,
    });
  });
});

describe("moving a charge", () => {
  const paydayFinance = (dayOfMonth: number) => ({
    ...emptyFinanceStore,
    monthlySalary: {
      "2026-09": { amount: 2000, dayOfMonth, updatedAt: "2026-09-01T00:00:00.000Z" },
    },
    budgetCycle: { anchor: "payday" as const, updatedAt: "2026-10-01T00:00:00.000Z" },
  });

  it("keeps calendar months from the open month to the end of the next one", () => {
    expect(occurrenceMoveRange("2026-10")).toEqual({ min: "2026-10-01", max: "2026-11-30" });
    expect(canMoveOccurrence(occurrence("old", 10, "2026-09-08", "paid"), "2026-10")).toBe(false);
    expect(canMoveOccurrence(occurrence("late", 10, "2026-09-08"), "2026-10")).toBe(true);
    expect(canMoveOccurrence(occurrence("now", 10, "2026-10-08", "paid"), "2026-10")).toBe(true);
  });

  it("follows the payday cycle, never before the calendar month of today", () => {
    // Cobro el 28: "noviembre" va del 28 de octubre al 27 de noviembre.
    const late = resolveBudgetCycle(paydayFinance(28));
    expect(occurrenceMoveRange("2026-11", late, "2026-10-30")).toEqual({
      min: "2026-10-28",
      max: "2026-12-27",
    });
    // Lo pagado el 29 de octubre es de este ciclo; lo del 20, del anterior.
    expect(
      canMoveOccurrence(occurrence("internet", 10, "2026-10-29", "paid"), "2026-11", late, "2026-10-30"),
    ).toBe(true);
    expect(
      canMoveOccurrence(occurrence("gym", 10, "2026-10-20", "paid"), "2026-11", late, "2026-10-30"),
    ).toBe(false);
    expect(
      canMoveOccurrence(occurrence("gym", 10, "2026-10-20"), "2026-11", late, "2026-10-30"),
    ).toBe(true);

    // Cobro el 5: "octubre" va del 5 de octubre al 4 de noviembre, pero el 2
    // de noviembre octubre ya es historial.
    const early = resolveBudgetCycle(paydayFinance(5));
    expect(occurrenceMoveRange("2026-10", early, "2026-11-02")).toEqual({
      min: "2026-11-01",
      max: "2026-12-04",
    });
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
