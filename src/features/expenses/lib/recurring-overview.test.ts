import { describe, expect, it } from "vitest";
import type { ExpenseOccurrenceOverride, ExpenseTemplate } from "@/domain/types";
import { buildRecurringOverview } from "./recurring-overview";

function template(
  id: string,
  recurrence: ExpenseTemplate["recurrence"],
  startDate = "2026-01-05",
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 100,
    currency: "EUR",
    categoryId: "cat",
    startDate,
    dueDay: Number(startDate.slice(-2)),
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("recurring overview", () => {
  it("ignores monthly recurring charges", () => {
    const items = buildRecurringOverview({
      templates: [
        template("Mensual", { frequency: "monthly" }),
      ],
      overrides: [],
      windowStart: "2026-06-01",
      windowEnd: "2026-06-30",
    });

    expect(items).toEqual([]);
  });

  it("keeps off-month annual charges in the recurring panel as upcoming", () => {
    const items = buildRecurringOverview({
      templates: [
        template("Seguro coche", { frequency: "yearly", annualMonth: 9 }),
      ],
      overrides: [],
      windowStart: "2026-06-01",
      windowEnd: "2026-06-30",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: "upcoming",
      nextOccurrence: {
        dueDate: "2026-09-05",
      },
    });
  });

  it("does not assume previous unpaid recurring charges were paid", () => {
    const items = buildRecurringOverview({
      templates: [
        template("Trimestral", { frequency: "quarterly" }),
      ],
      overrides: [],
      windowStart: "2026-06-01",
      windowEnd: "2026-06-30",
    });

    expect(items[0].status).toBe("overdue");
    expect(items[0].overdueOccurrence?.dueDate).toBe("2026-04-05");
  });

  it("tracks paid history separately from the next due charge", () => {
    const overrides: ExpenseOccurrenceOverride[] = [
      {
        id: "paid-january",
        userId: "demo",
        templateId: "Trimestral",
        occurrenceDate: "2026-01-05",
        status: "paid",
        paidAt: "2026-01-05T10:00:00.000Z",
      },
    ];

    const items = buildRecurringOverview({
      templates: [
        template("Trimestral", { frequency: "quarterly" }),
      ],
      overrides,
      windowStart: "2026-06-01",
      windowEnd: "2026-06-30",
    });

    expect(items[0].lastPaidOccurrence?.dueDate).toBe("2026-01-05");
    expect(items[0].nextOccurrence?.dueDate).toBe("2026-07-05");
  });
});
