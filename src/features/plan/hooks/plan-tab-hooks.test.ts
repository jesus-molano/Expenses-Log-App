import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALENDAR_CYCLE } from "@/domain/budget-cycle";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate, FinanceStore } from "@/domain/types";
import { useActiveBudgetMonth } from "./use-active-budget-month";
import { useAnnualPlan } from "./use-annual-plan";
import { useMonthPlan } from "./use-month-plan";
import { useMonthlyExpenseActions } from "./use-monthly-expense-actions";
import { useSavingsContributionEditor } from "./use-savings-contribution-editor";

const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

function template(id: string, amount: number, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [template("rent", 700, 1), template("power", 60, 20)],
  overrides: [
    {
      id: "ovr:rent:2026-10-01",
      userId: "demo",
      templateId: "rent",
      occurrenceDate: "2026-10-01",
      status: "paid",
      paidAt: "2026-10-01T09:00:00.000Z",
    },
  ],
  finance: {
    ...emptyFinanceStore,
    monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
    incomeEvents: [
      {
        id: "bizum",
        userId: "demo",
        name: "Bizum",
        amount: 40,
        currency: "EUR",
        receivedAt: "2026-10-05",
        createdAt: "2026-10-05T10:00:00.000Z",
        updatedAt: "2026-10-05T10:00:00.000Z",
      },
    ],
  },
};

describe("plan tab hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the plan of the viewed month with pending bills first", () => {
    const today = new Date("2026-10-23T10:00:00");
    const { result, rerender } = renderHook(
      ({ viewMonthId }) =>
        useMonthPlan({
          store,
          viewMonthId,
          activeMonthId: "2026-10",
          cycle: CALENDAR_CYCLE,
          today,
          language: "es",
        }),
      { initialProps: { viewMonthId: "2026-10" } },
    );

    expect(result.current.receipts.items.map((item) => item.template.id)).toEqual([
      "power",
      "rent",
    ]);
    expect(result.current.receipts.pendingCount).toBe(1);
    expect(result.current.plan).toMatchObject({ phase: "current", pendingExpensesTotal: 60 });
    expect(result.current.incomeEvents.map((event) => event.id)).toEqual(["bizum"]);
    expect(result.current.paydayOutlook).not.toBeNull();

    // Otro mes: proyectado y sin "Hasta el cobro".
    rerender({ viewMonthId: "2026-11" });
    expect(result.current.plan.phase).toBe("projected");
    expect(result.current.paydayOutlook).toBeNull();
    expect(result.current.incomeEvents).toEqual([]);
  });

  it("follows the active month, not the one viewed in Gastos", () => {
    const closed: ExpenseStore = {
      ...store,
      finance: {
        ...store.finance,
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-23T09:00:00.000Z",
            updatedAt: "2026-10-23T09:00:00.000Z",
          },
        },
      },
    };
    const { result } = renderHook(() => useActiveBudgetMonth(closed));

    expect(result.current).toMatchObject({
      language: "es",
      todayDateOnly: "2026-10-23",
      activeMonthId: "2026-11",
    });
  });

  it("edits the single savings contribution of a month", () => {
    const onSave = vi.fn();
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      monthlySavingsTargets: { "2026-01": { amount: 300, updatedAt: "2026-01-01T00:00:00.000Z" } },
      monthlySavingsContributions: {
        "2026-09": {
          id: "saving:2026-09",
          userId: "demo",
          monthId: "2026-09",
          amount: 120,
          source: "legacy",
          createdAt: "2026-09-30T10:00:00.000Z",
          updatedAt: "2026-09-30T10:00:00.000Z",
        },
      },
    };
    const { result } = renderHook(() =>
      useSavingsContributionEditor({ finance, language: "es", onSave }),
    );

    act(() => result.current.open("2026-09-01"));
    expect(result.current).toMatchObject({
      monthId: "2026-09",
      actualText: "120",
      target: 300,
      legacyWithoutDate: true,
    });

    // Un texto ilegible no guarda nada; un 0 escrito sí.
    act(() => result.current.setActualText("mucho"));
    act(() => result.current.submit(submitEvent));
    expect(onSave).not.toHaveBeenCalled();
    act(() => result.current.setActualText("0"));
    act(() => result.current.submit(submitEvent));
    expect(onSave).toHaveBeenCalledWith({ monthId: "2026-09", amount: 0 });
    expect(result.current.monthId).toBeNull();
  });

  it("asks to update the series after paying another amount", () => {
    const updateMonthlyExpenseOccurrence = vi.fn();
    const setSeriesAmount = vi.fn();
    const { result } = renderHook(() =>
      useMonthlyExpenseActions({
        store,
        language: "es",
        updateMonthlyExpenseOccurrence,
        setSeriesAmount,
      }),
    );
    const input = {
      templateId: "power",
      occurrenceDate: "2026-10-20",
      dueDate: "2026-10-20",
      name: "power",
      amount: 60,
      status: "paid" as const,
    };

    act(() => result.current.updateMonthlyExpense(input));
    expect(updateMonthlyExpenseOccurrence).toHaveBeenCalledWith(input);
    expect(result.current.seriesPrompt.prompt).toBeNull();

    act(() => result.current.updateMonthlyExpense({ ...input, amountPaid: 71.2 }));
    expect(result.current.seriesPrompt.prompt).toMatchObject({ templateId: "power", to: 71.2 });
  });

  it("charts the year of the active month and lets another one be picked", () => {
    const today = new Date("2026-12-15T10:00:00");
    const { result } = renderHook(() =>
      useAnnualPlan({
        store,
        today,
        language: "es",
        activeMonthId: "2026-12",
        cycle: CALENDAR_CYCLE,
      }),
    );

    expect(result.current.year).toBe(2026);
    expect(result.current.moneySeries).toHaveLength(12);
    // En diciembre ya se puede planificar el año siguiente.
    expect(result.current.availableYears).toEqual([2026, 2027]);
    expect(result.current.totals.expenses).toBeGreaterThan(0);

    act(() => result.current.selectYear(2027));
    expect(result.current.year).toBe(2027);
    expect(result.current.moneySeries[0].id).toBe("2027-01-01");
  });
});
