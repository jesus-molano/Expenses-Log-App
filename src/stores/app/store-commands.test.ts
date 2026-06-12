import { describe, expect, it, vi } from "vitest";
import { PLAN_ACCOUNT_NAME_MAX_LENGTH } from "@/domain/plan-accounts";
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
  updateMonthlyExpenseOccurrenceInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateMonthlySalaryInStore,
  updateMonthlySavingsTargetInStore,
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
      savingsMonthId: "2026-06",
      savingsTarget: 250,
      accounts: [
        {
          id: "acct-test",
          name: "Principal",
          purposes: ["salary", "daily"],
        },
      ],
    });

    expect(financeStore.finance.monthlySalary["2026-06"]).toMatchObject({
      amount: 1800,
      dayOfMonth: 25,
    });
    expect(financeStore.finance).toMatchObject({
      monthlySavingsTargets: {
        "2026-06": 250,
      },
      accounts: [
        {
          id: "acct-test",
          name: "Principal",
          purposes: ["salary", "daily"],
        },
      ],
    });

    expect(updateThemeInStore(emptyStore, "catppuccin").preferences?.theme).toBe(
      "catppuccin",
    );
    expect(updateLanguageInStore(emptyStore, "en").preferences?.language).toBe(
      "en",
    );
  });

  it("normalizes configurable accounts", () => {
    const updated = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06",
      savingsTarget: 250,
      accounts: [
        {
          id: "acct-test",
          name: "Cuenta con nombre demasiado largo para mobile",
          purposes: ["daily", "other", "legacy" as never],
        },
      ],
    });

    expect(updated.finance.accounts[0].name).toHaveLength(
      PLAN_ACCOUNT_NAME_MAX_LENGTH,
    );
    expect(updated.finance.accounts[0].purposes).toEqual(["daily", "other"]);
  });

  it("updates only the savings target for a selected month", () => {
    const withSettings = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06-01",
      savingsTarget: 250,
      accounts: [
        {
          id: "acct-test",
          name: "Principal",
          purposes: ["salary", "daily"],
        },
      ],
    });

    const updated = updateMonthlySavingsTargetInStore(withSettings, {
      monthId: "2026-07-01",
      savingsTarget: 800,
    });

    expect(updated.finance).toMatchObject({
      monthlySavingsTargets: {
        "2026-06": 250,
        "2026-07": 800,
      },
    });
    expect(updated.finance.monthlySalary).toEqual(withSettings.finance.monthlySalary);
  });

  it("updates only the salary settings for a selected month", () => {
    const withSettings = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06-01",
      savingsTarget: 250,
      accounts: [
        {
          id: "acct-test",
          name: "Principal",
          purposes: ["salary", "daily"],
        },
      ],
    });

    const updated = updateMonthlySalaryInStore(withSettings, {
      monthId: "2026-07-01",
      salaryAmount: 2200,
      salaryDay: 27,
    });

    expect(updated.finance.monthlySalary).toMatchObject({
      "2026-06": {
        amount: 1800,
        dayOfMonth: 25,
      },
      "2026-07": {
        amount: 2200,
        dayOfMonth: 27,
      },
    });
    expect(updated.finance.monthlySavingsTargets).toEqual(
      withSettings.finance.monthlySavingsTargets,
    );
    expect(updated.finance.accounts).toEqual(withSettings.finance.accounts);
  });

  it("updates a single monthly expense occurrence with a snapshot", () => {
    const added = addExpenseToStore(emptyStore, draft);
    const occurrence = occurrenceFrom(added);
    const updated = updateMonthlyExpenseOccurrenceInStore(added, {
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      dueDate: "2026-06-03",
      name: "Parking junio",
      amount: 35,
      categoryId: occurrence.template.categoryId,
      status: "paid",
    });

    expect(updated.overrides[0]).toMatchObject({
      templateId: occurrence.template.id,
      occurrenceDate: "2026-06-01",
      dueDate: "2026-06-03",
      name: "Parking junio",
      amount: 35,
      status: "paid",
      amountPaid: 35,
    });
  });
});
