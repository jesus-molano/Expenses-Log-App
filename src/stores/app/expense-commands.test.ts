import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { DraftExpense, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  addExpenseToStore,
  addExpensesToStore,
  markOccurrencesPaidInStore,
  skipOccurrencesInStore,
} from "./expense-commands";

const monthly = (name: string, dueDay: number): DraftExpense => ({
  name,
  description: "",
  amount: 10,
  categoryName: "Suscripciones",
  startDate: "2026-10-01",
  dueDay,
  recurrence: { frequency: "monthly" },
});

describe("adding captured expenses", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
    let id = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `00000000-0000-4000-8000-${String((id += 1)).padStart(12, "0")}`,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("marks as paid only the charges that already passed this month", () => {
    const store = addExpensesToStore(
      emptyStore,
      [monthly("Netflix", 5), monthly("Gimnasio", 28)],
      { initialStatus: "paid" },
    );

    expect(store.templates).toHaveLength(2);
    expect(store.overrides).toEqual([
      expect.objectContaining({ occurrenceDate: "2026-10-05", status: "paid" }),
    ]);
  });

  it("pays the real first charge of a yearly expense", () => {
    const store = addExpenseToStore(
      emptyStore,
      { ...monthly("Seguro", 15), recurrence: { frequency: "yearly", annualMonth: 3 } },
      { initialStatus: "paid" },
    );

    expect(store.overrides[0]).toMatchObject({ occurrenceDate: "2027-03-15" });
  });
});

describe("expenses that started in a past month (M18)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const startedInJuly = { ...monthly("Netflix", 5), startDate: "2026-07-05" };

  it("marks the previous months paid on their bank charge day", () => {
    const store = addExpenseToStore(emptyStore, startedInJuly, { previousCharges: "paid" });

    // El 5 de julio y el 5 de septiembre caen en fin de semana: se cargan el lunes.
    expect(
      store.overrides.map((override) => [override.occurrenceDate, override.status, override.paidAt]),
    ).toEqual([
      ["2026-07-05", "paid", "2026-07-06T12:00:00.000Z"],
      ["2026-08-05", "paid", "2026-08-05T12:00:00.000Z"],
      ["2026-09-05", "paid", "2026-09-07T12:00:00.000Z"],
    ]);
    expect(store.overrides.every((override) => override.amountPaid === 10)).toBe(true);
  });

  it("skips the previous months and leaves this month's charge alone", () => {
    const store = addExpenseToStore(emptyStore, startedInJuly, { previousCharges: "skipped" });

    expect(store.overrides.map((override) => [override.occurrenceDate, override.status])).toEqual([
      ["2026-07-05", "skipped"],
      ["2026-08-05", "skipped"],
      ["2026-09-05", "skipped"],
    ]);
  });

  it("leaves the previous months pending without a choice", () => {
    expect(addExpenseToStore(emptyStore, startedInJuly).overrides).toEqual([]);
  });

  it("pays this month's passed charge, not the first one of the series", () => {
    const store = addExpenseToStore(emptyStore, startedInJuly, { initialStatus: "paid" });

    expect(store.overrides).toEqual([
      expect.objectContaining({ occurrenceDate: "2026-10-05", status: "paid" }),
    ]);
  });

  it("applies the choice to every captured expense", () => {
    const store = addExpensesToStore(
      emptyStore,
      [startedInJuly, { ...monthly("Gimnasio", 28), startDate: "2026-09-28" }],
      { initialStatus: "paid", previousCharges: "paid" },
    );

    // El gimnasio del 28 de octubre aún no ha llegado: queda pendiente.
    expect(store.overrides.map((override) => override.occurrenceDate).sort()).toEqual([
      "2026-07-05",
      "2026-08-05",
      "2026-09-05",
      "2026-09-28",
      "2026-10-05",
    ]);
  });
});

describe("bulk occurrence commands", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [
      seriesTemplate("rent", 1, 700),
      seriesTemplate("power", 20, 60),
    ],
  };
  const occurrences = generateStoreOccurrences(store, "2026-10-01", "2026-10-31");

  it("marks several charges paid in one change and keeps what was already paid", () => {
    const paidRent = markOccurrencesPaidInStore(store, occurrences.slice(0, 1));
    const rentPaidAt = paidRent.overrides[0].paidAt;
    const both = markOccurrencesPaidInStore(
      paidRent,
      generateStoreOccurrences(paidRent, "2026-10-01", "2026-10-31"),
    );

    expect(both.overrides.map((override) => [override.templateId, override.status])).toEqual([
      ["rent", "paid"],
      ["power", "paid"],
    ]);
    expect(both.overrides[0].paidAt).toBe(rentPaidAt);
    expect(both.overrides[1]).toMatchObject({ amountPaid: 60, id: "ovr:power:2026-10-20" });
  });

  it("dates late payments with the given function", () => {
    const paid = markOccurrencesPaidInStore(store, occurrences, {
      paidAt: (occurrence) => `${occurrence.dueDate}T08:00:00.000Z`,
    });

    expect(paid.overrides.map((override) => override.paidAt)).toEqual([
      "2026-10-01T08:00:00.000Z",
      "2026-10-20T08:00:00.000Z",
    ]);
  });

  it("skips several charges keeping their edits", () => {
    const skipped = skipOccurrencesInStore(
      {
        ...store,
        overrides: [
          {
            id: "ovr:power:2026-10-20",
            userId: "demo",
            templateId: "power",
            occurrenceDate: "2026-10-20",
            status: "due",
            amount: 74.3,
          },
        ],
      },
      occurrences,
    );

    expect(skipped.overrides.map((override) => [override.templateId, override.status])).toEqual([
      ["rent", "skipped"],
      ["power", "skipped"],
    ]);
    expect(skipped.overrides.find((override) => override.templateId === "power")?.amount).toBe(
      74.3,
    );
  });
});

function seriesTemplate(id: string, dueDay: number, amount: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "home",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}
