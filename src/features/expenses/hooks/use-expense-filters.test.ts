import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import { useExpenseFilters } from "./use-expense-filters";

afterEach(() => {
  vi.useRealTimers();
});

describe("expense timeline window", () => {
  it("shows the first seven days of next month without changing current-month summaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 12));

    const rentTemplate = monthlyTemplate("rent", "2026-07-01", 1);
    const quarterlyTemplate: ExpenseTemplate = {
      ...monthlyTemplate("quarterly", "2026-05-05", 5),
      recurrence: { frequency: "quarterly" },
    };
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        rentTemplate,
        monthlyTemplate("day-seven", "2026-07-07", 7),
        monthlyTemplate("day-eight", "2026-07-08", 8),
        monthlyTemplate("shifted", "2026-07-02", 2),
        quarterlyTemplate,
      ],
      overrides: [
        paidOverride("rent", "2026-07-01"),
        paidOverride("day-seven", "2026-07-07"),
        paidOverride("day-eight", "2026-07-08"),
        paidOverride("shifted", "2026-07-02"),
        paidOverride("quarterly", "2026-05-05"),
        {
          id: "shifted-august",
          userId: "demo",
          templateId: "shifted",
          occurrenceDate: "2026-08-02",
          dueDate: "2026-08-12",
          status: "due",
        },
      ],
    };

    const { result } = renderHook(() => useExpenseFilters(store, "es"));
    const nextMonthDates = result.current.visibleOccurrences
      .filter((item) => item.occurrenceDate.startsWith("2026-08"))
      .map((item) => item.dueDate);

    expect(nextMonthDates).toEqual([
      "2026-08-01",
      "2026-08-05",
      "2026-08-07",
    ]);
    expect(nextMonthDates).not.toContain("2026-08-08");
    expect(nextMonthDates).not.toContain("2026-08-12");
    expect(result.current.timelineSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "future-2026-08-01",
          items: [expect.objectContaining({ dueDate: "2026-08-01" })],
        }),
      ]),
    );
    expect(result.current.pendingTotal).toBe(0);
    expect(result.current.recurringOverviewItems).toEqual([
      expect.objectContaining({
        template: expect.objectContaining({ id: "quarterly" }),
        currentOccurrence: null,
        nextOccurrence: expect.objectContaining({ dueDate: "2026-08-05" }),
      }),
    ]);
  });

  it("crosses the year boundary and includes January 7 but not January 8", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12));

    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        monthlyTemplate("day-seven", "2026-12-07", 7),
        monthlyTemplate("day-eight", "2026-12-08", 8),
      ],
      overrides: [
        paidOverride("day-seven", "2026-12-07"),
        paidOverride("day-eight", "2026-12-08"),
      ],
    };

    const { result } = renderHook(() => useExpenseFilters(store, "es"));
    const januaryDates = result.current.visibleOccurrences
      .filter((item) => item.occurrenceDate.startsWith("2027-01"))
      .map((item) => item.dueDate);

    expect(januaryDates).toEqual(["2027-01-07"]);
    expect(result.current.pendingTotal).toBe(0);
  });
});

function monthlyTemplate(
  id: string,
  startDate: string,
  dueDay: number,
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 100,
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
