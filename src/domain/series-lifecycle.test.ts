import { describe, expect, it } from "vitest";
import { emptyStore } from "./seed";
import {
  endChargeChoices,
  latestPaidChargeDate,
  pauseResumeChoices,
  pauseStartChoices,
  pauseUntilResume,
  reanchorLifecycleForSchedule,
  seriesAmountPromptFor,
  seriesLifecycle,
} from "./series-lifecycle";
import type { ExpenseOccurrenceOverride, ExpenseStore, ExpenseTemplate } from "./types";

const TODAY = new Date("2026-10-23T10:00:00");

const gym: ExpenseTemplate = {
  id: "gym",
  userId: "demo",
  name: "Gimnasio",
  description: "",
  amount: 35,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-06-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function paid(occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:gym:${occurrenceDate}`,
    userId: "demo",
    templateId: "gym",
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

function storeWith(overrides: ExpenseOccurrenceOverride[] = []): ExpenseStore {
  return { ...emptyStore, templates: [gym], overrides };
}

describe("series lifecycle choices", () => {
  it("offers last month's charge and the next ones as the last charge", () => {
    expect(endChargeChoices(storeWith(), gym, TODAY, 4)).toEqual([
      { date: "2026-09-05", paid: false },
      { date: "2026-10-05", paid: false },
      { date: "2026-11-05", paid: false },
      { date: "2026-12-05", paid: false },
    ]);
  });

  it("never offers to end before a paid charge", () => {
    const store = storeWith([paid("2026-10-05"), paid("2026-11-05")]);

    expect(latestPaidChargeDate(store, "gym", TODAY)).toBe("2026-11-05");
    expect(endChargeChoices(store, gym, TODAY, 2)).toEqual([
      { date: "2026-11-05", paid: true },
      { date: "2026-12-05", paid: false },
    ]);
  });

  it("starts a pause at a pending charge after the last paid one", () => {
    expect(pauseStartChoices(storeWith([paid("2026-10-05")]), gym, TODAY, 3)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
    ]);
    // Un cobro de este mes aún sin pagar también se puede saltar.
    expect(pauseStartChoices(storeWith(), gym, TODAY, 1)).toEqual(["2026-10-05"]);
  });

  it("resumes with a later charge, pausing until the day before it", () => {
    expect(pauseResumeChoices(gym, "2026-11-05", 2)).toEqual(["2026-12-05", "2027-01-05"]);
    expect(pauseUntilResume("2026-11-05", "2027-02-05")).toEqual({
      from: "2026-11-05",
      to: "2027-02-04",
    });
    expect(pauseUntilResume("2026-11-05")).toEqual({ from: "2026-11-05" });
  });

  it("finds yearly charges years ahead", () => {
    const yearly: ExpenseTemplate = {
      ...gym,
      startDate: "2026-03-18",
      dueDay: 18,
      recurrence: { frequency: "yearly", annualMonth: 3 },
    };

    expect(pauseStartChoices({ ...emptyStore, templates: [yearly] }, yearly, TODAY, 2)).toEqual([
      "2027-03-18",
      "2028-03-18",
    ]);
  });
});

describe("series lifecycle status", () => {
  it("describes the end and its last charge", () => {
    expect(seriesLifecycle({ ...gym, endDate: "2026-12-20" }, "2026-10-23").end).toEqual({
      date: "2026-12-20",
      lastCharge: "2026-12-05",
      past: false,
    });
    expect(seriesLifecycle({ ...gym, endDate: "2026-09-05" }, "2026-10-23").end?.past).toBe(true);
    expect(seriesLifecycle(gym, "2026-10-23")).toEqual({ end: null, pause: null });
  });

  it("describes an active pause with its first skipped charge and its return", () => {
    const paused = { ...gym, pauses: [{ from: "2026-10-01", to: "2027-01-04" }] };

    expect(seriesLifecycle(paused, "2026-10-23").pause).toEqual({
      pause: { from: "2026-10-01", to: "2027-01-04" },
      active: true,
      firstSkipped: "2026-10-05",
      resumesOn: "2027-01-05",
    });
  });

  it("describes an open pause and a scheduled one", () => {
    expect(seriesLifecycle({ ...gym, pauses: [{ from: "2026-10-06" }] }, "2026-10-23").pause)
      .toMatchObject({ active: true, firstSkipped: "2026-11-05", resumesOn: null });
    expect(
      seriesLifecycle({ ...gym, pauses: [{ from: "2026-12-01", to: "2026-12-31" }] }, "2026-10-23")
        .pause,
    ).toMatchObject({ active: false, firstSkipped: "2026-12-05", resumesOn: "2027-01-05" });
  });
});

describe("re-anchoring the end and pauses to a new schedule", () => {
  const onDay = (dueDay: number, template: ExpenseTemplate = gym) => ({ ...template, dueDay });

  it("keeps ending after the same charge", () => {
    const ending = { ...gym, endDate: "2026-12-05" };

    expect(reanchorLifecycleForSchedule(ending, onDay(10, ending)).endDate).toBe("2026-12-10");
    expect(reanchorLifecycleForSchedule(ending, onDay(3, ending)).endDate).toBe("2026-12-03");
    // Un fin libre que sigue entre el mismo cobro y el siguiente se conserva.
    const free = { ...gym, endDate: "2026-12-20" };
    expect(reanchorLifecycleForSchedule(free, onDay(10, free)).endDate).toBe("2026-12-20");
    expect(reanchorLifecycleForSchedule(free, onDay(25, free)).endDate).toBe("2026-12-25");
  });

  it("keeps a pause skipping the same charges and no others", () => {
    const paused = { ...gym, pauses: [pauseUntilResume("2026-11-05", "2027-01-05")] };
    const open = { ...gym, pauses: [{ from: "2026-10-06" }] };
    // Empezó tras el cobro de octubre y se reanudó antes del de noviembre.
    const skippedNothing = { ...gym, pauses: [{ from: "2026-10-06", to: "2026-10-22" }] };

    expect(reanchorLifecycleForSchedule(paused, onDay(3, paused)).pauses).toEqual([
      { from: "2026-11-03", to: "2027-01-02" },
    ]);
    expect(reanchorLifecycleForSchedule(paused, onDay(20, paused)).pauses).toEqual([
      { from: "2026-11-20", to: "2027-01-19" },
    ]);
    expect(reanchorLifecycleForSchedule(open, onDay(20, open)).pauses).toEqual([
      { from: "2026-11-20" },
    ]);
    expect(reanchorLifecycleForSchedule(skippedNothing, onDay(10, skippedNothing)).pauses).toEqual(
      [{ from: "2026-10-11", to: "2026-10-22" }],
    );
    expect(
      reanchorLifecycleForSchedule(skippedNothing, onDay(25, skippedNothing)).pauses,
    ).toBeUndefined();
  });

  it("leaves series with several charges a month as they were", () => {
    const weekly: ExpenseTemplate = {
      ...gym,
      recurrence: { frequency: "custom", interval: 1, unit: "week" },
      endDate: "2026-12-05",
      pauses: [{ from: "2026-11-05", to: "2026-11-30" }],
    };

    expect(
      reanchorLifecycleForSchedule(weekly, { ...weekly, startDate: "2026-06-08" }),
    ).toEqual({ endDate: weekly.endDate, pauses: weekly.pauses });
  });
});

describe("series amount prompt", () => {
  it("asks only when what was paid differs from the upcoming charges", () => {
    const store = storeWith();

    expect(seriesAmountPromptFor(store, "gym", 35, "2026-10-23")).toBeNull();
    expect(seriesAmountPromptFor(store, "gym", 39.9, "2026-10-23")).toEqual({
      templateId: "gym",
      name: "Gimnasio",
      from: 35,
      to: 39.9,
    });
  });

  it("compares with the scheduled price in force and skips finished or one-off series", () => {
    const priced = {
      ...emptyStore,
      templates: [
        { ...gym, amountChanges: [{ from: "2026-10-01", amount: 39.9 }] },
        { ...gym, id: "once", recurrence: { frequency: "once" as const } },
        { ...gym, id: "ended", endDate: "2026-09-30" },
      ],
    };

    expect(seriesAmountPromptFor(priced, "gym", 39.9, "2026-10-23")).toBeNull();
    expect(seriesAmountPromptFor(priced, "once", 50, "2026-10-23")).toBeNull();
    expect(seriesAmountPromptFor(priced, "ended", 50, "2026-10-23")).toBeNull();
    expect(seriesAmountPromptFor(priced, "missing", 50, "2026-10-23")).toBeNull();
  });

  it("measures the active month with the payday-anchored budget cycle", () => {
    // Cobro el 28 y octubre cerrado: "noviembre" empezó el 28 de octubre, así
    // que hoy rige el precio de hoy y no el que empieza el 1 de noviembre.
    const anchored: ExpenseStore = {
      ...emptyStore,
      templates: [{ ...gym, amountChanges: [{ from: "2026-11-01", amount: 39.9 }] }],
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 28 } },
        budgetCycle: { anchor: "payday", updatedAt: "2026-10-01T00:00:00.000Z" },
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-27T10:00:00.000Z",
            updatedAt: "2026-10-27T10:00:00.000Z",
          },
        },
      },
    };

    expect(seriesAmountPromptFor(anchored, "gym", 35, "2026-10-29")).toBeNull();
    expect(seriesAmountPromptFor(anchored, "gym", 39.9, "2026-10-29")).toMatchObject({
      from: 35,
      to: 39.9,
    });
  });
});
