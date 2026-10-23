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
