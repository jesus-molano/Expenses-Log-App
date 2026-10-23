import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { DraftExpense } from "@/domain/types";
import { addExpenseToStore, addExpensesToStore } from "./expense-commands";

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

describe("paying a different amount", () => {
  it("records what was paid without changing the planned amount, and unpaying undoes it", async () => {
    const { payOccurrenceInStore, togglePaidInStore } = await import("./expense-commands");
    const { generateStoreOccurrences } = await import("@/domain/finance");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
    const store = addExpenseToStore(emptyStore, { ...monthly("Luz", 5), amount: 60 });
    const occurrence = generateStoreOccurrences(store, "2026-10-05", "2026-10-05")[0];

    const paid = payOccurrenceInStore(store, occurrence, 71.2);
    const paidOccurrence = generateStoreOccurrences(paid, "2026-10-05", "2026-10-05")[0];
    expect(paidOccurrence).toMatchObject({ status: "paid", template: { amount: 60 } });
    expect(paidOccurrence.override).toMatchObject({ amountPaid: 71.2 });
    expect(paidOccurrence.override?.amount).toBeUndefined();

    const unpaid = togglePaidInStore(paid, paidOccurrence);
    const back = generateStoreOccurrences(unpaid, "2026-10-05", "2026-10-05")[0];
    expect(back).toMatchObject({ status: "due", template: { amount: 60 } });
    expect(back.override?.amountPaid).toBeUndefined();
    vi.useRealTimers();
  });
});
