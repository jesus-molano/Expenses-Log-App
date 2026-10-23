import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMonthlyMoneyPlan } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import { occurrencesForMonth } from "@/features/plan/lib/plan-dashboard";
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

    const { result } = renderHook(() => useExpenseFilters(store, "es", new Date()));
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

    const { result } = renderHook(() => useExpenseFilters(store, "es", new Date()));
    const januaryDates = result.current.visibleOccurrences
      .filter((item) => item.occurrenceDate.startsWith("2027-01"))
      .map((item) => item.dueDate);

    expect(januaryDates).toEqual(["2027-01-07"]);
    expect(result.current.pendingTotal).toBe(0);
  });
});

describe("month boundary", () => {
  it("keeps last month's unpaid bills in their own section after the 1st", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        monthlyTemplate("internet", "2026-09-28", 28),
        monthlyTemplate("rent", "2026-09-05", 5),
      ],
      overrides: [
        paidOverride("internet", "2026-09-28"),
        paidOverride("rent", "2026-09-05"),
        paidOverride("rent", "2026-10-05"),
      ],
    };

    const { result, rerender } = renderHook(
      ({ now }) => useExpenseFilters(store, "es", now),
      { initialProps: { now: new Date(2026, 9, 31, 23, 59) } },
    );

    expect(result.current.pendingTotal).toBe(100);
    expect(
      result.current.timelineSections.some((section) =>
        section.id.startsWith("carry-over-"),
      ),
    ).toBe(false);

    rerender({ now: new Date(2026, 10, 1, 0, 5) });

    const carryOver = result.current.timelineSections.find(
      (section) => section.id === "carry-over-2026-10",
    );
    expect(carryOver).toMatchObject({
      title: "Pendiente de octubre",
      total: 100,
      items: [expect.objectContaining({ dueDate: "2026-10-28" })],
    });
    expect(result.current.timelineSections[0].id).toBe("carry-over-2026-10");
    expect(result.current.pendingTotal).toBe(200);
  });

  it("matches the Plan pending total, including weekend and moved bills", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12));

    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        monthlyTemplate("saturday", "2026-10-31", 31),
        monthlyTemplate("moved-in", "2026-11-03", 3),
        monthlyTemplate("moved-out", "2026-10-20", 20),
        monthlyTemplate("prepaid", "2026-11-01", 1),
      ],
      overrides: [
        {
          id: "moved-in:2026-11-03",
          userId: "demo",
          templateId: "moved-in",
          occurrenceDate: "2026-11-03",
          dueDate: "2026-10-30",
          status: "due",
        },
        {
          id: "moved-out:2026-10-20",
          userId: "demo",
          templateId: "moved-out",
          occurrenceDate: "2026-10-20",
          dueDate: "2026-11-15",
          status: "due",
        },
        paidOverride("prepaid", "2026-11-01"),
      ],
    };

    const { result } = renderHook(() =>
      useExpenseFilters(store, "es", new Date()),
    );
    const monthDate = new Date(2026, 9, 1);
    const plan = buildMonthlyMoneyPlan({
      monthDate,
      finance: store.finance,
      occurrences: occurrencesForMonth(store, monthDate, "es"),
      today: new Date(),
    });

    expect(result.current.pendingTotal).toBe(200);
    expect(plan.pendingExpensesTotal).toBe(result.current.pendingTotal);
    expect(
      result.current.visibleOccurrences.map((item) => item.dueDate),
    ).not.toContain("2026-11-15");
  });
});

describe("viewed month", () => {
  it("shows the next month with its own pending total before it starts", () => {
    // Octubre está pagado; en noviembre el alquiler ya está pagado y la luz no.
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        monthlyTemplate("rent", "2026-10-01", 1),
        monthlyTemplate("power", "2026-10-12", 12),
      ],
      overrides: [
        paidOverride("rent", "2026-10-01"),
        paidOverride("power", "2026-10-12"),
        paidOverride("rent", "2026-11-01"),
      ],
    };

    const { result } = renderHook(() =>
      useExpenseFilters(store, "es", new Date(2026, 9, 28, 10), "2026-11"),
    );

    expect(result.current.pendingTotal).toBe(100);
    expect(
      result.current.visibleOccurrences.map((item) => item.dueDate),
    ).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-12", "2026-12-01"]));
    expect(
      result.current.visibleOccurrences.some((item) => item.dueDate < "2026-11-01"),
    ).toBe(false);
    expect(
      result.current.timelineSections.find((section) => section.id === "month-start"),
    ).toMatchObject({ title: "noviembre empieza en 4 días", anchorDate: "2026-11-01" });
    expect(
      result.current.timelineSections.some((section) => section.id === "today"),
    ).toBe(false);
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
