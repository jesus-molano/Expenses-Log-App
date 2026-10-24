import { describe, expect, it } from "vitest";
import { estimateChargeDate } from "./calendar";
import {
  firstChargeAlreadyPassed,
  firstOccurrenceDate,
  generateOccurrences,
  generateTemplateDates,
  passedChargeThisMonth,
  previousMonthsChargeDates,
} from "./recurrence";
import type { ExpenseTemplate } from "./types";

const baseTemplate: ExpenseTemplate = {
  id: "exp-test",
  userId: "demo",
  name: "Test",
  description: "",
  amount: 10,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-01-31",
  dueDay: 31,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("recurrence", () => {
  it("clips monthly due day to the end of shorter months", () => {
    expect(
      generateTemplateDates(baseTemplate, "2026-01-01", "2026-03-31"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("generates quarterly occurrences", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-01-12",
          dueDay: 12,
          recurrence: { frequency: "quarterly" },
        },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01-12", "2026-04-12", "2026-07-12", "2026-10-12"]);
  });

  it("generates annual occurrences on the configured month and day", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-05-18",
          dueDay: 18,
          recurrence: { frequency: "yearly", annualMonth: 5 },
        },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-05-18"]);
  });

  it("generates a one-time occurrence only on its start date", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-09-12",
          dueDay: 12,
          recurrence: { frequency: "once" },
        },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-09-12"]);

    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-09-12",
          dueDay: 12,
          recurrence: { frequency: "once" },
        },
        "2026-10-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });

  it("keeps weekly custom recurrence anchored to the start date", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-06-03",
          dueDay: 3,
          recurrence: { frequency: "custom", interval: 2, unit: "week" },
        },
        "2026-06-01",
        "2026-07-05",
      ),
    ).toEqual(["2026-06-03", "2026-06-17", "2026-07-01"]);
  });

  it("includes the configured end month and excludes later monthly charges", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-05-20",
          endDate: "2026-06-20",
          dueDay: 20,
          recurrence: { frequency: "monthly" },
        },
        "2026-05-01",
        "2026-07-31",
      ),
    ).toEqual(["2026-05-20", "2026-06-20"]);
  });

  it("clips annual due day to the configured month end", () => {
    expect(
      generateTemplateDates(
        {
          ...baseTemplate,
          startDate: "2026-02-01",
          dueDay: 31,
          recurrence: { frequency: "yearly", annualMonth: 2 },
        },
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-02-28"]);
  });

  it("moves weekend estimates to Monday", () => {
    expect(estimateChargeDate("2026-06-13")).toMatchObject({
      date: "2026-06-15",
      label: "estimado lunes 15",
    });
    expect(estimateChargeDate("2026-06-14")).toMatchObject({
      date: "2026-06-15",
      label: "estimado lunes 15",
    });
  });

  it("localizes charge estimate labels", () => {
    expect(estimateChargeDate("2026-06-15", "en")).toMatchObject({
      date: "2026-06-15",
      label: "charges Monday 15",
    });
    expect(estimateChargeDate("2026-06-14", "en")).toMatchObject({
      date: "2026-06-15",
      label: "estimated Monday 15",
    });
  });

  it("applies paid overrides without duplicating generated rows", () => {
    const [occurrence] = generateOccurrences(
      [{ ...baseTemplate, startDate: "2026-06-10", dueDay: 10 }],
      [
        {
          id: "override",
          userId: "demo",
          templateId: "exp-test",
          occurrenceDate: "2026-06-10",
          status: "paid",
          paidAt: "2026-06-10T09:00:00.000Z",
        },
      ],
      "2026-06-01",
      "2026-06-30",
      "en",
    );

    expect(occurrence.status).toBe("paid");
    expect(occurrence.estimatedChargeLabel).toBe("charges Wednesday 10");
  });

  it("gives same-day generated occurrences stable sortable gaps", () => {
    const occurrences = generateOccurrences(
      [
        {
          ...baseTemplate,
          id: "exp-a",
          name: "A",
          startDate: "2026-06-15",
          dueDay: 15,
        },
        {
          ...baseTemplate,
          id: "exp-b",
          name: "B",
          startDate: "2026-06-15",
          dueDay: 15,
        },
        {
          ...baseTemplate,
          id: "exp-c",
          name: "C",
          startDate: "2026-06-15",
          dueDay: 15,
        },
      ],
      [],
      "2026-06-01",
      "2026-06-30",
    );

    expect(occurrences.map((occurrence) => occurrence.sortOrder)).toEqual([
      0, 1024, 2048,
    ]);
  });
});

describe("generateTemplateDates with invalid data", () => {
  const base = {
    id: "broken",
    userId: "demo",
    name: "Broken",
    description: "",
    amount: 10,
    currency: "EUR" as const,
    categoryId: "cat",
    startDate: "2026-11-31",
    dueDay: 31,
    recurrence: { frequency: "monthly" as const },
    active: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };

  it("returns no dates instead of throwing for impossible dates", () => {
    expect(() =>
      generateTemplateDates(base, "2026-11-01", "2026-12-31"),
    ).not.toThrow();
    expect(generateTemplateDates(base, "2026-11-01", "2026-12-31")).toEqual([]);
    expect(
      generateTemplateDates(
        { ...base, startDate: "2026-11-01", endDate: "nope" },
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });

  it("ignores an empty end date and an invalid rrule", () => {
    expect(
      generateTemplateDates(
        { ...base, startDate: "2026-11-01", dueDay: 1, endDate: "" },
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-11-01", "2026-12-01"]);
    expect(
      generateTemplateDates(
        {
          ...base,
          startDate: "2026-11-01",
          recurrence: { frequency: "rrule", rrule: "NOT A RULE" },
        },
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });
});

describe("generateTemplateDates with an rrule", () => {
  const rruleTemplate = (rrule: string) => ({
    ...baseTemplate,
    startDate: "2026-01-01",
    dueDay: 15,
    recurrence: { frequency: "rrule" as const, rrule },
  });
  const range = (count: number) => Array.from({ length: count }, (_, index) => index).join(",");

  it("expands no sub-daily rule, from a crafted store or file", { timeout: 500 }, () => {
    for (const rrule of [
      "FREQ=HOURLY;DTSTART=20260101T000000Z",
      "FREQ=MINUTELY;DTSTART=20260101T000000Z",
      "FREQ=SECONDLY;DTSTART=20260101T000000Z",
      `FREQ=YEARLY;BYHOUR=${range(24)};BYMINUTE=${range(60)};DTSTART=20260101T000000Z`,
      `FREQ=DAILY;BYSECOND=${range(60)};DTSTART=20260101T000000Z`,
    ]) {
      expect(generateTemplateDates(rruleTemplate(rrule), "2026-01-01", "2026-12-31")).toEqual(
        [],
      );
    }
  });

  it("keeps a monthly rule's charges", () => {
    expect(
      generateTemplateDates(
        rruleTemplate("FREQ=MONTHLY;BYMONTHDAY=15;DTSTART=20260101T000000Z"),
        "2026-01-01",
        "2026-04-30",
      ),
    ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("counts once the dates of a month that fall on the same charge day", () => {
    expect(
      generateTemplateDates(
        rruleTemplate("FREQ=WEEKLY;BYDAY=MO;DTSTART=20260101T000000Z"),
        "2026-01-01",
        "2026-03-31",
      ),
    ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });
});

describe("first charge of a new expense", () => {
  const draft = {
    name: "Netflix",
    description: "",
    amount: 10,
    categoryName: "Suscripciones",
    dueDay: 25,
    recurrence: { frequency: "monthly" as const },
  };

  it("uses the charge day, not the start date", () => {
    expect(firstOccurrenceDate({ ...draft, startDate: "2026-10-01" })).toBe("2026-10-25");
    expect(firstChargeAlreadyPassed({ ...draft, startDate: "2026-10-01" }, "2026-10-23")).toBe(false);
    expect(firstChargeAlreadyPassed({ ...draft, dueDay: 5, startDate: "2026-10-01" }, "2026-10-23")).toBe(true);
  });

  it("counts from the 1st when there is no start date", () => {
    expect(firstChargeAlreadyPassed({ ...draft, dueDay: 5 }, "2026-10-23")).toBe(true);
  });

  it("asks for this month's charge of an expense that started months ago", () => {
    const started = { ...draft, dueDay: 5, startDate: "2026-07-05" };

    expect(passedChargeThisMonth(started, "2026-10-23")).toBe("2026-10-05");
    expect(firstChargeAlreadyPassed(started, "2026-10-23")).toBe(true);
    // El día 1 no hay nada de este mes que ya haya pasado.
    expect(passedChargeThisMonth({ ...started, dueDay: 1 }, "2026-10-01")).toBeNull();
  });

  it("does not ask for a yearly expense due in another month", () => {
    expect(
      firstChargeAlreadyPassed(
        { ...draft, dueDay: 5, startDate: "2026-10-01", recurrence: { frequency: "yearly", annualMonth: 3 } },
        "2026-10-23",
      ),
    ).toBe(false);
  });
});

describe("charges before this month of a new expense (M18)", () => {
  const draft = {
    name: "Netflix",
    description: "",
    amount: 10,
    categoryName: "Suscripciones",
    dueDay: 5,
    recurrence: { frequency: "monthly" as const },
  };

  it("lists the charges of the months already closed", () => {
    expect(previousMonthsChargeDates({ ...draft, startDate: "2026-07-05" }, "2026-10-23")).toEqual([
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
    ]);
  });

  it("does not count a charge before the start date in its first month", () => {
    expect(
      previousMonthsChargeDates({ ...draft, dueDay: 2, startDate: "2026-09-10" }, "2026-10-23"),
    ).toEqual([]);
    expect(
      previousMonthsChargeDates({ ...draft, dueDay: 20, startDate: "2026-09-10" }, "2026-10-23"),
    ).toEqual(["2026-09-20"]);
  });

  it("asks nothing for an expense starting this month, a future one or a bad date", () => {
    expect(previousMonthsChargeDates({ ...draft, startDate: "2026-10-01" }, "2026-10-23")).toEqual([]);
    expect(previousMonthsChargeDates({ ...draft, startDate: "2026-12-01" }, "2026-10-23")).toEqual([]);
    expect(previousMonthsChargeDates({ ...draft, startDate: "no-date" }, "2026-10-23")).toEqual([]);
    expect(previousMonthsChargeDates(draft, "2026-10-23")).toEqual([]);
  });

  it("follows yearly series and stops at the end date", () => {
    expect(
      previousMonthsChargeDates(
        {
          ...draft,
          dueDay: 15,
          startDate: "2025-03-15",
          recurrence: { frequency: "yearly", annualMonth: 3 },
        },
        "2026-10-23",
      ),
    ).toEqual(["2025-03-15", "2026-03-15"]);
    expect(
      previousMonthsChargeDates(
        { ...draft, startDate: "2026-07-05", endDate: "2026-08-31" },
        "2026-10-23",
      ),
    ).toEqual(["2026-07-05", "2026-08-05"]);
  });

  it("crosses the year boundary in January", () => {
    expect(previousMonthsChargeDates({ ...draft, startDate: "2026-11-05" }, "2027-01-10")).toEqual([
      "2026-11-05",
      "2026-12-05",
    ]);
  });

  it("skips the charges of a saved series that fall in a pause", () => {
    const paused = {
      ...draft,
      startDate: "2026-07-05",
      pauses: [{ from: "2026-08-01", to: "2026-08-31" }, { from: "2026-10-01" }],
    };

    expect(previousMonthsChargeDates(paused, "2026-10-23")).toEqual(["2026-07-05", "2026-09-05"]);
    expect(passedChargeThisMonth(paused, "2026-10-23")).toBeNull();
    expect(firstChargeAlreadyPassed(paused, "2026-10-23")).toBe(false);
  });
});
