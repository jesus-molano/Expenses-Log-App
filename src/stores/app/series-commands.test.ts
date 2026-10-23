import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import { latestPaidChargeDate } from "@/domain/series-lifecycle";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { closeMonthInStore } from "./finance-commands";
import {
  endSeriesInStore,
  pauseSeriesInStore,
  payOccurrenceInStore,
  reactivateSeriesInStore,
  removeAmountChangeInStore,
  removePauseInStore,
  resumeSeriesInStore,
  scheduleAmountChangeInStore,
  setSeriesAmountInStore,
  togglePaidInStore,
} from "./store-commands";
import { preserveClosedOccurrenceRecords } from "./store-history";

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

// Como en la app: cada cambio pasa por persist, que congela los meses cerrados.
function commit(store: ExpenseStore, next: ExpenseStore) {
  return preserveClosedOccurrenceRecords(store, next);
}

function occurrenceOn(store: ExpenseStore, date: string) {
  const occurrence = generateStoreOccurrences(store, date, date).find(
    (item) => item.template.id === "luz",
  );
  if (!occurrence) throw new Error(`No charge on ${date}`);
  return occurrence;
}

function pay(store: ExpenseStore, date: string) {
  return commit(store, togglePaidInStore(store, occurrenceOn(store, date)));
}

function summary(store: ExpenseStore, from = "2026-08-01", to = "2027-01-31") {
  return Object.fromEntries(
    generateStoreOccurrences(store, from, to)
      .filter((occurrence) => occurrence.template.id === "luz")
      .map((occurrence) => [
        occurrence.occurrenceDate.slice(0, 7),
        occurrence.status === "paid"
          ? `${occurrence.template.amount}/${occurrence.override?.amountPaid ?? occurrence.record?.amountPaid}`
          : occurrence.template.amount,
      ]),
  );
}

describe("series commands", () => {
  let store: ExpenseStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
    store = { ...emptyStore, templates: [luz] };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("paying a different amount", () => {
    it("keeps the planned amount and records what was paid", () => {
      const next = payOccurrenceInStore(store, occurrenceOn(store, "2026-10-08"), 74.3);

      expect(summary(next)).toMatchObject({ "2026-10": "60/74.3", "2026-11": 60 });
      expect(next.overrides[0]).toMatchObject({ status: "paid", amountPaid: 74.3 });
    });

    it("corrects the amount of a charge already paid without moving its payment date", () => {
      const paidStore = pay(store, "2026-10-08");
      const paidAt = paidStore.overrides[0].paidAt;
      vi.setSystemTime(new Date("2026-10-25T10:00:00"));

      const next = payOccurrenceInStore(
        paidStore,
        occurrenceOn(paidStore, "2026-10-08"),
        71.2,
      );

      expect(next.overrides[0]).toMatchObject({ amountPaid: 71.2, paidAt });
    });

    it("ignores an unreadable amount", () => {
      expect(payOccurrenceInStore(store, occurrenceOn(store, "2026-10-08"), 0)).toBe(store);
    });

    it("can then update the series from now on without touching what is paid", () => {
      store = pay(store, "2026-09-08");
      const paid = commit(
        store,
        payOccurrenceInStore(store, occurrenceOn(store, "2026-10-08"), 74.3),
      );

      const updated = commit(paid, setSeriesAmountInStore(paid, "luz", 74.3));

      expect(summary(updated)).toEqual({
        "2026-08": 60,
        "2026-09": "60/60",
        "2026-10": "60/74.3",
        "2026-11": 74.3,
        "2026-12": 74.3,
        "2027-01": 74.3,
      });
    });
  });

  describe("series amount", () => {
    it("replaces earlier price changes from the month it applies and keeps later ones", () => {
      store = {
        ...store,
        templates: [
          {
            ...luz,
            amountChanges: [
              { from: "2026-09-01", amount: 65 },
              { from: "2027-01-01", amount: 80 },
            ],
          },
        ],
      };

      const next = commit(store, setSeriesAmountInStore(store, "luz", 70));

      expect(next.templates[0]).toMatchObject({
        amount: 70,
        amountChanges: [{ from: "2027-01-01", amount: 80 }],
      });
      expect(summary(next)).toEqual({
        "2026-08": 60,
        "2026-09": 65,
        "2026-10": 70,
        "2026-11": 70,
        "2026-12": 70,
        "2027-01": 80,
      });
    });

    it("keeps the active month when the new amount starts next month", () => {
      const next = commit(store, setSeriesAmountInStore(store, "luz", 70, { scope: "next" }));

      expect(summary(next)).toMatchObject({ "2026-10": 60, "2026-11": 70 });
    });

    it("pins a paid charge priced by a scheduled change at that price", () => {
      store = {
        ...store,
        templates: [{ ...luz, amountChanges: [{ from: "2026-10-01", amount: 65 }] }],
      };
      store = pay(store, "2026-10-08");

      const next = commit(store, setSeriesAmountInStore(store, "luz", 60));

      expect(summary(next)).toMatchObject({ "2026-10": "65/65", "2026-11": 60 });
      expect(next.templates[0].amountChanges).toBeUndefined();
    });
  });

  describe("scheduled price changes", () => {
    it("prices charges from the chosen month and keeps a prepaid one", () => {
      store = pay(store, "2026-11-08");

      const next = commit(
        store,
        scheduleAmountChangeInStore(store, "luz", { from: "2026-11-01", amount: 66 }),
      );

      expect(next.templates[0].amountChanges).toEqual([{ from: "2026-11-01", amount: 66 }]);
      expect(summary(next)).toMatchObject({
        "2026-10": 60,
        "2026-11": "60/60",
        "2026-12": 66,
        "2027-01": 66,
      });
    });

    it("rejects an impossible change", () => {
      expect(scheduleAmountChangeInStore(store, "luz", { from: "2026-13-01", amount: 66 })).toBe(store);
      expect(scheduleAmountChangeInStore(store, "luz", { from: "2026-12-01", amount: -1 })).toBe(store);
      expect(scheduleAmountChangeInStore(store, "nope", { from: "2026-12-01", amount: 5 })).toBe(store);
    });

    it("removes a scheduled change", () => {
      const scheduled = scheduleAmountChangeInStore(store, "luz", { from: "2026-12-01", amount: 66 });

      const removed = removeAmountChangeInStore(scheduled, "luz", "2026-12-01");

      expect(removed.templates[0].amountChanges).toBeUndefined();
      expect(summary(removed)).toMatchObject({ "2026-12": 60 });
      expect(removeAmountChangeInStore(removed, "luz", "2026-12-01")).toBe(removed);
    });
  });

  describe("finishing a subscription", () => {
    it("ends after the chosen last charge and keeps earlier months", () => {
      store = pay(store, "2026-09-08");

      const next = commit(store, endSeriesInStore(store, "luz", "2026-11-08"));

      expect(next.templates[0].endDate).toBe("2026-11-08");
      expect(Object.keys(summary(next))).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    });

    it("never ends before a charge that is already paid", () => {
      store = pay(store, "2026-11-08");

      const next = endSeriesInStore(store, "luz", "2026-09-08");

      expect(next.templates[0].endDate).toBe("2026-11-08");
      expect(latestPaidChargeDate(store, "luz")).toBe("2026-11-08");
    });

    it("can be reactivated", () => {
      const ended = endSeriesInStore(store, "luz", "2026-10-08");

      expect(reactivateSeriesInStore(ended, "luz").templates[0].endDate).toBeUndefined();
      expect(reactivateSeriesInStore(store, "luz")).toBe(store);
    });
  });

  describe("pausing a subscription", () => {
    it("skips the charges in the pause and brings them back after it", () => {
      const next = commit(
        store,
        pauseSeriesInStore(store, "luz", { from: "2026-11-01", to: "2027-01-07" }),
      );

      expect(summary(next)).toEqual({
        "2026-08": 60,
        "2026-09": 60,
        "2026-10": 60,
        "2027-01": 60,
      });
    });

    it("never hides a paid charge: the pause starts the day after it", () => {
      store = pay(store, "2026-11-08");

      const next = pauseSeriesInStore(store, "luz", { from: "2026-11-01" });

      expect(next.templates[0].pauses).toEqual([{ from: "2026-11-09" }]);
      expect(pauseSeriesInStore(store, "luz", { from: "2026-11-01", to: "2026-11-08" })).toBe(store);
    });

    it("resumes today and removes a scheduled pause", () => {
      store = pauseSeriesInStore(store, "luz", { from: "2026-10-01" });
      store = pauseSeriesInStore(store, "luz", { from: "2027-03-01", to: "2027-03-31" });

      const resumed = resumeSeriesInStore(store, "luz");

      expect(resumed.templates[0].pauses).toEqual([
        { from: "2026-10-01", to: "2026-10-22" },
        { from: "2027-03-01", to: "2027-03-31" },
      ]);
      expect(removePauseInStore(resumed, "luz", "2027-03-01").templates[0].pauses).toEqual([
        { from: "2026-10-01", to: "2026-10-22" },
      ]);
      expect(resumeSeriesInStore({ ...emptyStore, templates: [luz] }, "luz").templates[0]).toBe(luz);
    });

    it("keeps a closed month that was paused afterwards", () => {
      store = pay(store, "2026-09-08");
      vi.setSystemTime(new Date("2026-10-28T10:00:00"));
      store = commit(store, closeMonthInStore(store, "2026-10"));

      const next = commit(store, pauseSeriesInStore(store, "luz", { from: "2026-08-01" }));

      // Agosto y septiembre ya son registros: la pausa con efecto atrás no los
      // toca, y de octubre en adelante no se genera nada.
      expect(next.templates[0].pauses).toEqual([{ from: "2026-08-01" }]);
      expect(summary(next)).toEqual({ "2026-08": 60, "2026-09": "60/60" });
    });
  });
});
