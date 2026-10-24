import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseOccurrenceOverride, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { useEndSeriesSheet } from "./use-end-series-sheet";
import { OPEN_PAUSE, usePauseSeriesSheet } from "./use-pause-series-sheet";
import { usePayAmountFlow } from "./use-pay-amount-flow";
import { usePriceChangeSheet } from "./use-price-change-sheet";
import { useSeriesAmountPrompt } from "./use-series-amount-prompt";

const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
const NOW = new Date("2026-10-23T10:00:00");

const luz: ExpenseTemplate = {
  id: "luz",
  userId: "demo",
  name: "Luz",
  description: "",
  amount: 60,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-06-08",
  dueDay: 8,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function paid(occurrenceDate: string, amountPaid: number): ExpenseOccurrenceOverride {
  return {
    id: `ovr:luz:${occurrenceDate}`,
    userId: "demo",
    templateId: "luz",
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    amountPaid,
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [luz],
  overrides: [paid("2026-08-08", 70), paid("2026-09-08", 74)],
};

function october(target: ExpenseStore = store) {
  return generateStoreOccurrences(target, "2026-10-08", "2026-10-08")[0];
}

describe("series hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useSeriesAmountPrompt", () => {
    it("asks only when the paid amount differs from the upcoming charges", () => {
      const setSeriesAmount = vi.fn();
      const { result } = renderHook(() => useSeriesAmountPrompt({ store, setSeriesAmount }));

      let asked: boolean | undefined;
      act(() => {
        asked = result.current.askAfterPayment("luz", 60);
      });
      expect(asked).toBe(false);
      act(() => {
        asked = result.current.askAfterPayment("luz", 74.3);
      });
      expect(asked).toBe(true);
      expect(result.current.prompt).toEqual({ templateId: "luz", name: "Luz", from: 60, to: 74.3 });

      act(() => {
        result.current.apply();
      });
      expect(setSeriesAmount).toHaveBeenCalledWith("luz", 74.3);
      expect(result.current.prompt).toBeNull();
    });

    it("does not ask for a one-off payment or a finished series", () => {
      const finished: ExpenseStore = {
        ...store,
        templates: [
          { ...luz, id: "once", recurrence: { frequency: "once" } },
          { ...luz, id: "ended", endDate: "2026-09-30" },
        ],
      };
      const { result } = renderHook(() =>
        useSeriesAmountPrompt({ store: finished, setSeriesAmount: vi.fn() }),
      );

      const answers: boolean[] = [];
      act(() => {
        answers.push(
          result.current.askAfterPayment("once", 80),
          result.current.askAfterPayment("ended", 80),
          result.current.askAfterPayment("missing", 80),
        );
      });
      expect(answers).toEqual([false, false, false]);
      expect(result.current.prompt).toBeNull();
    });
  });

  describe("usePayAmountFlow", () => {
    function setup() {
      const payOccurrence = vi.fn();
      const setSeriesAmount = vi.fn();
      const onSeriesUpdated = vi.fn();
      const hook = renderHook(() =>
        usePayAmountFlow({
          store,
          language: "es",
          payOccurrence,
          setSeriesAmount,
          onSeriesUpdated,
        }),
      );
      return { ...hook, payOccurrence, setSeriesAmount, onSeriesUpdated };
    }

    it("suggests the average of the last payments and pays the planned amount without asking", () => {
      const { result, payOccurrence } = setup();

      act(() => result.current.open(october()));
      expect(result.current.amountText).toBe("60");
      expect(result.current.suggestion).toEqual({ amount: 72, count: 2 });

      act(() => result.current.save(submitEvent));
      expect(payOccurrence).toHaveBeenCalledWith(october(), 60);
      expect(result.current.occurrence).toBeNull();
    });

    it("asks to update the series after paying a different amount", () => {
      const { result, payOccurrence, setSeriesAmount, onSeriesUpdated } = setup();

      act(() => result.current.open(october()));
      act(() => result.current.setAmountText("74,30"));
      act(() => result.current.save(submitEvent));

      expect(payOccurrence).toHaveBeenCalledWith(october(), 74.3);
      expect(result.current.seriesPrompt).toMatchObject({ from: 60, to: 74.3 });

      act(() => result.current.applySeries());
      expect(setSeriesAmount).toHaveBeenCalledWith("luz", 74.3);
      expect(onSeriesUpdated).toHaveBeenCalledWith(expect.objectContaining({ to: 74.3 }));
      expect(result.current.occurrence).toBeNull();
    });

    it("keeps the sheet open on an unreadable amount and prefills what was paid", () => {
      const { result, payOccurrence } = setup();
      const september = generateStoreOccurrences(store, "2026-09-08", "2026-09-08")[0];

      act(() => result.current.open(september));
      expect(result.current.amountText).toBe("74");
      act(() => result.current.setAmountText("mucho"));
      act(() => result.current.save(submitEvent));

      expect(payOccurrence).not.toHaveBeenCalled();
      expect(result.current.occurrence).not.toBeNull();
    });
  });

  describe("lifecycle sheets", () => {
    it("ends after the first pending charge by default", () => {
      const endSeries = vi.fn();
      const { result } = renderHook(() =>
        useEndSeriesSheet({ store, template: luz, now: NOW, endSeries }),
      );

      act(() => result.current.openSheet());
      expect(result.current.choices[0]).toEqual({ date: "2026-09-08", paid: true });
      expect(result.current.selected).toBe("2026-10-08");

      act(() => result.current.confirm());
      expect(endSeries).toHaveBeenCalledWith("luz", "2026-10-08");
      expect(result.current.open).toBe(false);
    });

    it("pauses from a pending charge until another one, counting what it skips", () => {
      const pauseSeries = vi.fn();
      const { result } = renderHook(() =>
        usePauseSeriesSheet({ store, template: luz, now: NOW, pauseSeries }),
      );

      act(() => result.current.openSheet());
      expect(result.current.from).toBe("2026-10-08");
      expect(result.current.resumeOn).toBe(OPEN_PAUSE);
      expect(result.current.skippedCount).toBeNull();

      act(() => result.current.setResumeOn("2027-01-08"));
      expect(result.current.skippedCount).toBe(3);

      // Un inicio posterior a la vuelta elegida la descarta.
      act(() => result.current.setFrom("2027-02-08"));
      expect(result.current.resumeOn).toBe(OPEN_PAUSE);

      act(() => result.current.setResumeOn("2027-04-08"));
      act(() => result.current.confirm());
      expect(pauseSeries).toHaveBeenCalledWith("luz", { from: "2027-02-08", to: "2027-04-07" });
    });

    it("drops a resume date the new start no longer offers", () => {
      const pauseSeries = vi.fn();
      const { result } = renderHook(() =>
        usePauseSeriesSheet({ store, template: luz, now: NOW, pauseSeries }),
      );

      act(() => result.current.openSheet());
      const firstStart = result.current.startChoices[0];
      act(() => result.current.setFrom(result.current.startChoices.at(-1) ?? ""));
      act(() => result.current.setResumeOn(result.current.resumeChoices.at(-1) ?? ""));
      expect(result.current.resumeOn).toBe("2027-09-08");

      // Desde octubre la vuelta de septiembre de 2027 ya no se lista.
      act(() => result.current.setFrom(firstStart));
      expect(result.current.resumeChoices).not.toContain("2027-09-08");
      expect(result.current.resumeOn).toBe(OPEN_PAUSE);
      expect(result.current.skippedCount).toBeNull();

      act(() => result.current.confirm());
      expect(pauseSeries).toHaveBeenCalledWith("luz", { from: "2026-10-08" });
    });

    it("schedules a price from the first day of a month after the active one", () => {
      const scheduleAmountChange = vi.fn();
      const { result } = renderHook(() =>
        usePriceChangeSheet({
          template: luz,
          currentAmount: 60,
          finance: store.finance,
          now: NOW,
          language: "es",
          scheduleAmountChange,
        }),
      );

      act(() => result.current.openSheet());
      expect(result.current.monthChoices[0]).toBe("2026-11");
      expect(result.current.monthChoices).toHaveLength(12);
      expect(result.current.amountText).toBe("60");

      act(() => result.current.setMonthId("2027-03"));
      act(() => result.current.setAmountText("15"));
      act(() => result.current.save(submitEvent));
      expect(scheduleAmountChange).toHaveBeenCalledWith("luz", { from: "2027-03-01", amount: 15 });
    });

    it.each([
      // Cobro el 5: "diciembre" empieza el 5 de diciembre.
      { payday: 5, now: "2026-11-10T10:00:00", firstChoice: "2026-12", from: "2026-12-05" },
      // Cobro el 28: "noviembre" empieza el 28 de octubre.
      { payday: 28, now: "2026-10-20T10:00:00", firstChoice: "2026-11", from: "2026-10-28" },
    ])(
      "schedules a price from the payday that opens the chosen month (payday $payday)",
      ({ payday, now, firstChoice, from }) => {
        const scheduleAmountChange = vi.fn();
        const finance = {
          ...store.finance,
          monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: payday } },
          budgetCycle: { anchor: "payday" as const, updatedAt: "2026-01-01T00:00:00.000Z" },
        };
        const { result } = renderHook(() =>
          usePriceChangeSheet({
            template: luz,
            currentAmount: 60,
            finance,
            now: new Date(now),
            language: "es",
            scheduleAmountChange,
          }),
        );

        act(() => result.current.openSheet());
        expect(result.current.monthId).toBe(firstChoice);
        act(() => result.current.setAmountText("15"));
        act(() => result.current.save(submitEvent));
        expect(scheduleAmountChange).toHaveBeenCalledWith("luz", { from, amount: 15 });
      },
    );
  });
});
