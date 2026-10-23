import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { closeMonthInStore } from "./finance-commands";
import {
  keepAmountBeforeSeriesChange,
  togglePaidInStore,
  updateExpenseTemplateInStore,
  type SeriesAmountScope,
} from "./store-commands";
import { preserveClosedOccurrenceRecords } from "./store-history";

const claude: ExpenseTemplate = {
  id: "claude",
  userId: "demo",
  name: "Claude",
  description: "",
  amount: 90,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-06-01",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
} as ExpenseTemplate;

// Como en la app: cada cambio pasa por persist, que congela los meses cerrados.
function commit(store: ExpenseStore, next: ExpenseStore) {
  return preserveClosedOccurrenceRecords(store, next);
}

function pay(store: ExpenseStore, date: string) {
  const occurrence = generateStoreOccurrences(store, date, date)[0];
  return commit(store, togglePaidInStore(store, occurrence));
}

function changeAmount(store: ExpenseStore, amount: number, scope: SeriesAmountScope = "current") {
  const kept = keepAmountBeforeSeriesChange(store, "claude", amount, { scope });
  return commit(store, updateExpenseTemplateInStore(kept, "claude", { amount }));
}

function amounts(store: ExpenseStore) {
  return Object.fromEntries(
    generateStoreOccurrences(store, "2026-08-01", "2026-12-31").map((occurrence) => [
      occurrence.occurrenceDate.slice(0, 7),
      occurrence.template.amount,
    ]),
  );
}

describe("changing the amount of a series", () => {
  let store: ExpenseStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
    store = { ...emptyStore, templates: [claude] };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never rewrites earlier months or what is already paid", () => {
    store = pay(pay(store, "2026-09-05"), "2026-10-05");

    expect(amounts(changeAmount(store, 200))).toEqual({
      "2026-08": 90,
      "2026-09": 90,
      "2026-10": 90,
      "2026-11": 200,
      "2026-12": 200,
    });
  });

  it("applies from this month when this month is still pending", () => {
    expect(amounts(changeAmount(store, 200))).toMatchObject({ "2026-10": 200, "2026-11": 200 });
  });

  it("can start next month", () => {
    expect(amounts(changeAmount(store, 200, "next"))).toMatchObject({ "2026-10": 90, "2026-11": 200 });
  });

  it("keeps a month closed with 'Pasar al mes siguiente' and a prepaid charge", () => {
    vi.setSystemTime(new Date("2026-10-28T10:00:00"));
    store = commit(store, closeMonthInStore(store, "2026-10"));
    store = pay(store, "2026-11-05");

    expect(amounts(changeAmount(store, 200))).toMatchObject({
      "2026-10": 90,
      "2026-11": 90,
      "2026-12": 200,
    });
  });

  it("does nothing when the amount does not change", () => {
    expect(keepAmountBeforeSeriesChange(store, "claude", 90)).toBe(store);
  });
});
