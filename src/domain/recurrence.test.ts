import { describe, expect, it } from "vitest";
import { estimateChargeDate } from "./calendar";
import { generateOccurrences, generateTemplateDates } from "./recurrence";
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
    });
    expect(estimateChargeDate("2026-06-14")).toMatchObject({
      date: "2026-06-15",
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
    );

    expect(occurrence.status).toBe("paid");
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
