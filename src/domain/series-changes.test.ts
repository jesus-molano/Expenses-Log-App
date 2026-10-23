import { describe, expect, it } from "vitest";
import {
  generateStoreOccurrences,
  materializeClosedOccurrenceRecords,
  occurrencesDueBetween,
} from "./finance";
import {
  currentOrNextPause,
  firstOccurrenceDate,
  generateOccurrences,
  generateTemplateDates,
  isPausedOn,
  resumePausesOn,
  templateAmountOn,
  withAmountChange,
  withPause,
} from "./recurrence";
import { emptyStore } from "./seed";
import type { ExpenseStore, ExpenseTemplate } from "./types";

const netflix: ExpenseTemplate = {
  id: "netflix",
  userId: "demo",
  name: "Netflix",
  description: "",
  amount: 12,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-01-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function amountsByDate(template: ExpenseTemplate, from: string, to: string) {
  return Object.fromEntries(
    generateOccurrences([template], [], from, to).map((occurrence) => [
      occurrence.occurrenceDate,
      occurrence.template.amount,
    ]),
  );
}

describe("pauses", () => {
  it("skips the charges inside a pause that crosses month boundaries", () => {
    expect(
      generateTemplateDates(
        { ...netflix, pauses: [{ from: "2026-01-20", to: "2026-03-10" }] },
        "2026-01-01",
        "2026-04-30",
      ),
    ).toEqual(["2026-01-05", "2026-04-05"]);
  });

  it("includes both ends of the pause and keeps the charge the day after", () => {
    expect(
      generateTemplateDates(
        { ...netflix, pauses: [{ from: "2026-02-05", to: "2026-03-04" }] },
        "2026-01-01",
        "2026-03-31",
      ),
    ).toEqual(["2026-01-05", "2026-03-05"]);
  });

  it("keeps an open pause going until it is resumed", () => {
    const paused = { ...netflix, pauses: [{ from: "2026-03-01" }] };

    expect(generateTemplateDates(paused, "2026-01-01", "2027-12-31")).toEqual([
      "2026-01-05",
      "2026-02-05",
    ]);
  });

  it("pauses weekly charges across the end of a month", () => {
    const weekly: ExpenseTemplate = {
      ...netflix,
      startDate: "2026-10-23",
      dueDay: 23,
      recurrence: { frequency: "custom", interval: 1, unit: "week" },
      pauses: [{ from: "2026-10-28", to: "2026-11-08" }],
    };

    expect(generateTemplateDates(weekly, "2026-10-01", "2026-11-30")).toEqual([
      "2026-10-23",
      "2026-11-13",
      "2026-11-20",
      "2026-11-27",
    ]);
  });

  it("clips the month end and pauses it like any other charge", () => {
    const monthEnd: ExpenseTemplate = {
      ...netflix,
      startDate: "2026-01-31",
      dueDay: 31,
      pauses: [{ from: "2026-02-28", to: "2026-02-28" }],
    };

    expect(generateTemplateDates(monthEnd, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("pauses yearly and quarterly series", () => {
    const yearly: ExpenseTemplate = {
      ...netflix,
      startDate: "2026-05-18",
      dueDay: 18,
      recurrence: { frequency: "yearly", annualMonth: 5 },
      pauses: [{ from: "2027-01-01", to: "2027-12-31" }],
    };
    const quarterly: ExpenseTemplate = {
      ...netflix,
      startDate: "2026-01-12",
      dueDay: 12,
      recurrence: { frequency: "quarterly" },
      pauses: [{ from: "2026-04-01", to: "2026-07-31" }],
    };

    expect(generateTemplateDates(yearly, "2026-01-01", "2028-12-31")).toEqual([
      "2026-05-18",
      "2028-05-18",
    ]);
    expect(generateTemplateDates(quarterly, "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-12",
      "2026-10-12",
    ]);
  });

  it("starts a series after a pause that covers its first charge", () => {
    expect(
      firstOccurrenceDate({ ...netflix, pauses: [{ from: "2026-01-01", to: "2026-02-28" }] }),
    ).toBe("2026-03-05");
  });

  it("tells whether a day is paused and which pause matters today", () => {
    const pauses = [
      { from: "2026-11-01", to: "2026-11-30" },
      { from: "2027-02-01" },
    ];

    expect(isPausedOn(pauses, "2026-11-30")).toBe(true);
    expect(isPausedOn(pauses, "2026-12-01")).toBe(false);
    expect(isPausedOn(pauses, "2030-01-01")).toBe(true);
    expect(currentOrNextPause(pauses, "2026-11-15")).toEqual({ pause: pauses[0], active: true });
    expect(currentOrNextPause(pauses, "2026-12-15")).toEqual({ pause: pauses[1], active: false });
    expect(currentOrNextPause([{ from: "2026-01-01", to: "2026-01-31" }], "2026-12-15")).toBeNull();
  });

  it("adds one pause per start date, sorted", () => {
    expect(
      withPause(
        [{ from: "2027-01-01" }, { from: "2026-11-01", to: "2026-11-30" }],
        { from: "2027-01-01", to: "2027-01-31" },
      ),
    ).toEqual([
      { from: "2026-11-01", to: "2026-11-30" },
      { from: "2027-01-01", to: "2027-01-31" },
    ]);
  });

  it("resumes today: the pause ends yesterday and later pauses stay", () => {
    expect(
      resumePausesOn(
        [
          { from: "2026-10-01" },
          { from: "2027-03-01", to: "2027-03-31" },
        ],
        "2026-11-04",
      ),
    ).toEqual([
      { from: "2026-10-01", to: "2026-11-03" },
      { from: "2027-03-01", to: "2027-03-31" },
    ]);
    // Una pausa que empezaba hoy no deja rastro.
    expect(resumePausesOn([{ from: "2026-11-04" }], "2026-11-04")).toEqual([]);
  });

  it("brings back today's charge after resuming", () => {
    const resumed = {
      ...netflix,
      pauses: resumePausesOn([{ from: "2026-09-01" }], "2026-11-05"),
    };

    expect(generateTemplateDates(resumed, "2026-08-01", "2026-12-31")).toEqual([
      "2026-08-05",
      "2026-11-05",
      "2026-12-05",
    ]);
  });
});

describe("end date", () => {
  it("excludes the month's charge when the series ends earlier in that month", () => {
    expect(
      generateTemplateDates(
        { ...netflix, startDate: "2026-01-20", dueDay: 20, endDate: "2026-03-15" },
        "2026-01-01",
        "2026-06-30",
      ),
    ).toEqual(["2026-01-20", "2026-02-20"]);
  });

  it("keeps the last charge when the series ends on its day", () => {
    expect(
      generateTemplateDates(
        { ...netflix, startDate: "2026-01-20", dueDay: 20, endDate: "2026-03-20" },
        "2026-01-01",
        "2026-06-30",
      ),
    ).toEqual(["2026-01-20", "2026-02-20", "2026-03-20"]);
  });

  it("ends weekly charges in the middle of a month", () => {
    expect(
      generateTemplateDates(
        {
          ...netflix,
          startDate: "2026-11-02",
          dueDay: 2,
          endDate: "2026-11-18",
          recurrence: { frequency: "custom", interval: 1, unit: "week" },
        },
        "2026-11-01",
        "2026-11-30",
      ),
    ).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("combines an end date with a pause", () => {
    expect(
      generateTemplateDates(
        {
          ...netflix,
          endDate: "2026-06-05",
          pauses: [{ from: "2026-03-01", to: "2026-04-30" }],
        },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01-05", "2026-02-05", "2026-05-05", "2026-06-05"]);
  });
});

describe("scheduled price changes", () => {
  const withRaise: ExpenseTemplate = {
    ...netflix,
    amountChanges: [
      { from: "2026-03-01", amount: 15 },
      { from: "2026-06-05", amount: 18 },
    ],
  };

  it("uses the latest change that has already started", () => {
    expect(templateAmountOn(withRaise, "2026-02-28")).toBe(12);
    expect(templateAmountOn(withRaise, "2026-03-01")).toBe(15);
    expect(templateAmountOn(withRaise, "2026-06-04")).toBe(15);
    expect(templateAmountOn(withRaise, "2026-06-05")).toBe(18);
    // El orden guardado no importa.
    expect(
      templateAmountOn(
        { ...netflix, amountChanges: [...(withRaise.amountChanges ?? [])].reverse() },
        "2026-07-01",
      ),
    ).toBe(18);
  });

  it("prices each generated charge by its own date", () => {
    expect(amountsByDate(withRaise, "2026-01-01", "2026-07-31")).toEqual({
      "2026-01-05": 12,
      "2026-02-05": 12,
      "2026-03-05": 15,
      "2026-04-05": 15,
      "2026-05-05": 15,
      "2026-06-05": 18,
      "2026-07-05": 18,
    });
  });

  it("keeps a one-off amount edit over the scheduled price", () => {
    const [march] = generateOccurrences(
      [withRaise],
      [
        {
          id: "ovr:netflix:2026-03-05",
          userId: "demo",
          templateId: "netflix",
          occurrenceDate: "2026-03-05",
          status: "due",
          amount: 13,
        },
      ],
      "2026-03-01",
      "2026-03-31",
    );

    expect(march.template.amount).toBe(13);
  });

  it("prices a charge moved to another month by its original date", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [withRaise],
      overrides: [
        {
          id: "ovr:netflix:2026-02-05",
          userId: "demo",
          templateId: "netflix",
          occurrenceDate: "2026-02-05",
          dueDate: "2026-03-02",
          status: "due",
        },
      ],
    };

    const march = occurrencesDueBetween(store, "2026-03-01", "2026-03-31");
    expect(march.map((occurrence) => [occurrence.occurrenceDate, occurrence.template.amount])).toEqual([
      ["2026-02-05", 12],
      ["2026-03-05", 15],
    ]);
  });

  it("schedules one price per date, sorted", () => {
    expect(
      withAmountChange(
        [{ from: "2026-06-01", amount: 18 }, { from: "2026-03-01", amount: 15 }],
        { from: "2026-06-01", amount: 20 },
      ),
    ).toEqual([
      { from: "2026-03-01", amount: 15 },
      { from: "2026-06-01", amount: 20 },
    ]);
  });
});

describe("records of closed months", () => {
  it("freezes the planned amount of each closed month with its scheduled price", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [{ ...netflix, amountChanges: [{ from: "2026-03-01", amount: 15 }] }],
    };

    const recorded = materializeClosedOccurrenceRecords(store, {
      today: new Date("2026-04-10T10:00:00"),
    });

    expect(
      recorded.occurrenceRecords?.map((record) => [record.monthId, record.plannedAmount]),
    ).toEqual([
      ["2026-01", 12],
      ["2026-02", 12],
      ["2026-03", 15],
    ]);
  });

  it("keeps closed months when the price changes, the series pauses or it ends later", () => {
    const recorded = materializeClosedOccurrenceRecords(
      { ...emptyStore, templates: [netflix] },
      { today: new Date("2026-04-10T10:00:00") },
    );
    const changed: ExpenseStore = {
      ...recorded,
      templates: [
        {
          ...netflix,
          amount: 20,
          amountChanges: [{ from: "2026-01-01", amount: 25 }],
          pauses: [{ from: "2026-02-01", to: "2026-05-31" }],
          endDate: "2026-02-10",
        },
      ],
    };

    expect(
      generateStoreOccurrences(changed, "2026-01-01", "2026-06-30").map((occurrence) => [
        occurrence.occurrenceDate,
        occurrence.template.amount,
      ]),
    ).toEqual([
      ["2026-01-05", 12],
      ["2026-02-05", 12],
      ["2026-03-05", 12],
    ]);
  });

  it("does not record a paused month as owed", () => {
    const recorded = materializeClosedOccurrenceRecords(
      {
        ...emptyStore,
        templates: [{ ...netflix, pauses: [{ from: "2026-02-01", to: "2026-02-28" }] }],
      },
      { today: new Date("2026-04-10T10:00:00") },
    );

    expect(recorded.occurrenceRecords?.map((record) => record.monthId)).toEqual([
      "2026-01",
      "2026-03",
    ]);
  });
});
