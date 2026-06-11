import { describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type {
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import {
  addExpenseToStore,
  clearExpensesFromStore,
  deleteExpenseFromStore,
  skipOccurrenceInStore,
  togglePaidInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateThemeInStore,
} from "./store-commands";

vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "test-id"),
});

const draft: DraftExpense = {
  name: "Parking",
  description: "",
  amount: 30,
  categoryName: "Transporte",
  tags: ["transporte"],
  dueDay: 1,
  recurrence: { frequency: "monthly" },
};

function occurrenceFrom(store: ExpenseStore): ExpenseOccurrence {
  const template = store.templates[0];
  return {
    id: `${template.id}:2026-06-01`,
    template,
    occurrenceDate: "2026-06-01",
    dueDate: "2026-06-01",
    estimatedChargeDate: "2026-06-01",
    estimatedChargeLabel: "",
    status: "due",
    sortOrder: 0,
  };
}

describe("store commands", () => {
  it("adds and deletes expenses without mutating finance/preferences", () => {
    const added = addExpenseToStore(emptyStore, draft);

    expect(added.templates).toHaveLength(1);
    expect(added.categories).toHaveLength(1);
    expect(added.finance).toEqual(emptyStore.finance);

    const deleted = deleteExpenseFromStore(added, added.templates[0].id);

    expect(deleted.templates).toHaveLength(0);
    expect(deleted.overrides).toHaveLength(0);
    expect(deleted.finance).toEqual(emptyStore.finance);
  });

  it("clears only expense data", () => {
    const added = addExpenseToStore(emptyStore, draft);
    const cleared = clearExpensesFromStore(added);

    expect(cleared.categories).toEqual([]);
    expect(cleared.templates).toEqual([]);
    expect(cleared.overrides).toEqual([]);
    expect(cleared.finance).toEqual(emptyStore.finance);
    expect(cleared.preferences).toEqual(emptyStore.preferences);
  });

  it("creates paid and skipped occurrence overrides", () => {
    const added = addExpenseToStore(emptyStore, draft);
    const occurrence = occurrenceFrom(added);

    const paid = togglePaidInStore(added, occurrence);
    expect(paid.overrides[0]).toMatchObject({
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      status: "paid",
      amountPaid: occurrence.template.amount,
    });

    const skipped = skipOccurrenceInStore(added, occurrence);
    expect(skipped.overrides[0]).toMatchObject({
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      status: "skipped",
    });
  });

  it("updates finance settings and preferences deterministically", () => {
    const financeStore = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsTarget: 250,
      expensesAccountName: "Gastos",
      savingsAccountName: "Ahorro",
      primaryAccountName: "Principal",
    });

    expect(financeStore.finance.incomeSources[0]).toMatchObject({
      amount: 1800,
      dayOfMonth: 25,
    });
    expect(financeStore.finance.allocation).toMatchObject({
      expensesAccountName: "Gastos",
      savingsAccountName: "Ahorro",
      primaryAccountName: "Principal",
      monthlySavingsTarget: 250,
    });

    expect(updateThemeInStore(emptyStore, "catppuccin").preferences?.theme).toBe(
      "catppuccin",
    );
    expect(updateLanguageInStore(emptyStore, "en").preferences?.language).toBe(
      "en",
    );
  });
});
