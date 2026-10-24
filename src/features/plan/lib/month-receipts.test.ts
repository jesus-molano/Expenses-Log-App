import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence, OccurrenceStatus } from "@/domain/types";
import { monthReceipts, monthReceiptsSummary } from "./month-receipts";

function occurrence(id: string, status: OccurrenceStatus): ExpenseOccurrence {
  return { id, status } as ExpenseOccurrence;
}

describe("monthReceipts", () => {
  it("lists pending bills first, keeps the date order and leaves out skipped ones", () => {
    const result = monthReceipts([
      occurrence("rent", "paid"),
      occurrence("power", "due"),
      occurrence("netflix", "skipped"),
      occurrence("gym", "paid"),
      occurrence("internet", "due"),
    ]);

    expect(result.items.map((item) => item.id)).toEqual(["power", "internet", "rent", "gym"]);
    expect(result.pendingCount).toBe(2);
  });
});

describe("monthReceiptsSummary", () => {
  const plan = { plannedExpenseCount: 5, pendingExpensesTotal: 343.81, paidExpensesTotal: 120 };

  it("says how many are pending and how much is left", () => {
    expect(monthReceiptsSummary(4, plan, "es")).toMatch(/^4 pendientes · 343,81\s€$/);
    expect(monthReceiptsSummary(1, plan, "es")).toMatch(/^1 pendiente · 343,81\s€$/);
    expect(monthReceiptsSummary(4, plan, "en")).toMatch(/^4 pending · 343,81\s€$/);
  });

  it("says everything is paid or that there are no bills", () => {
    expect(monthReceiptsSummary(0, plan, "es")).toMatch(/^Todo pagado · 120,00\s€$/);
    expect(monthReceiptsSummary(0, { ...plan, plannedExpenseCount: 0 }, "es")).toBe(
      "Sin recibos recurrentes este mes.",
    );
  });
});
