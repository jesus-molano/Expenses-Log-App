import { describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { DraftExpense, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import {
  addExpenseToStore,
  clearExpensesFromStore,
  clearIncomeFromStore,
  deleteExpenseFromStore,
  dismissLastChanceReminderInStore,
  moveOccurrenceOnlyInStore,
  moveOccurrenceSeriesInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
  updateMonthlyExpenseOccurrenceInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateMonthlySalaryInStore,
  updateMonthlySavingsContributionInStore,
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

  it("clears only income data", () => {
    const added = addExpenseToStore(emptyStore, draft);
    const incomeStore: ExpenseStore = {
      ...added,
      finance: {
        incomeEvents: [
          {
            id: "income-1",
            userId: "demo",
            name: "Bizum",
            amount: 45,
            currency: "EUR",
            receivedAt: "2026-06-02",
            createdAt: "2026-06-02T00:00:00.000Z",
            updatedAt: "2026-06-02T00:00:00.000Z",
          },
        ],
        monthlySalary: {
          "2026-06": {
            amount: 2200,
            dayOfMonth: 28,
          },
        },
        monthlySavingsTargets: {
          "2026-06": 500,
        },
      },
    };

    const cleared = clearIncomeFromStore(incomeStore);

    expect(cleared.finance.incomeEvents).toEqual([]);
    expect(cleared.finance.monthlySalary).toEqual({});
    expect(cleared.finance.monthlySavingsTargets).toEqual(
      incomeStore.finance.monthlySavingsTargets,
    );
    expect(cleared.categories).toEqual(incomeStore.categories);
    expect(cleared.templates).toEqual(incomeStore.templates);
    expect(cleared.overrides).toEqual(incomeStore.overrides);
    expect(cleared.deleted?.incomeEvents).toContain("income-1");
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

  it("dismisses a last chance reminder for a single charge occurrence", () => {
    const added = addExpenseToStore(emptyStore, {
      ...draft,
      reminder: {
        enabled: true,
        daysBeforeCharge: 3,
      },
    });
    const occurrence = {
      ...occurrenceFrom(added),
      estimatedChargeDate: "2026-06-02",
    };

    const dismissed = dismissLastChanceReminderInStore(added, occurrence);

    expect(dismissed.overrides[0]).toMatchObject({
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      status: "due",
      reminderDismissedChargeDate: "2026-06-02",
    });
    expect(dismissed.overrides[0].reminderDismissedAt).toBeTruthy();
  });

  it("does not persist weekend estimated charge dates as manual due dates", () => {
    const added = addExpenseToStore(emptyStore, {
      ...draft,
      name: "Dazn",
      dueDay: 13,
      startDate: "2026-06-13",
    });
    const template = added.templates[0];
    const estimatedWeekendOccurrence: ExpenseOccurrence = {
      id: `${template.id}:2026-06-13`,
      template,
      occurrenceDate: "2026-06-13",
      dueDate: "2026-06-15",
      estimatedChargeDate: "2026-06-15",
      estimatedChargeLabel: "estimado lunes 15",
      status: "due",
      sortOrder: 0,
    };
    const paid = togglePaidInStore(added, estimatedWeekendOccurrence);

    expect(paid.overrides[0]).toMatchObject({
      templateId: template.id,
      occurrenceDate: "2026-06-13",
      status: "paid",
    });
    expect(paid.overrides[0].dueDate).toBeUndefined();
  });

  it("updates finance settings and preferences deterministically", () => {
    const financeStore = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06",
      savingsTarget: 250,
    });

    expect(financeStore.finance.monthlySalary["2026-06"]).toMatchObject({
      amount: 1800,
      dayOfMonth: 25,
    });
    expect(financeStore.finance).toMatchObject({
      monthlySavingsTargets: {
        "2026-06": {
          amount: 250,
        },
      },
    });

    expect(updateThemeInStore(emptyStore, "catppuccin").preferences?.theme).toBe(
      "catppuccin",
    );
    expect(updateLanguageInStore(emptyStore, "en").preferences?.language).toBe(
      "en",
    );
  });

  it("updates only the savings target for a selected month", () => {
    const withSettings = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06-01",
      savingsTarget: 250,
    });

    const updated = updateMonthlySavingsTargetInStore(withSettings, {
      monthId: "2026-07-01",
      savingsTarget: 800,
    });

    expect(updated.finance).toMatchObject({
      monthlySavingsTargets: {
        "2026-06": {
          amount: 250,
        },
        "2026-07": {
          amount: 800,
        },
      },
    });
    expect(updated.finance.monthlySalary).toEqual(withSettings.finance.monthlySalary);
  });

  it("updates the real contribution without changing the savings goal", () => {
    const withGoal = updateMonthlySavingsTargetInStore(emptyStore, {
      monthId: "2026-08-01",
      savingsTarget: 500,
    });
    const updated = updateMonthlySavingsContributionInStore(withGoal, {
      monthId: "2026-08-01",
      amount: 325,
      transferredAt: "2026-08-05",
    });

    expect(updated.finance.monthlySavingsTargets["2026-08"])
      .toMatchObject({ amount: 500 });
    expect(updated.finance.monthlySavingsContributions?.["2026-08"])
      .toMatchObject({
        id: "saving:2026-08:test-id",
        amount: 325,
        transferredAt: "2026-08-05",
        source: "manual",
      });
  });

  it("updates only the salary settings for a selected month", () => {
    const withSettings = updateMoneySettingsInStore(emptyStore, {
      salaryAmount: 1800,
      salaryDay: 25,
      savingsMonthId: "2026-06-01",
      savingsTarget: 250,
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

  it("can revert a default series move into a one-off month move", () => {
    const added = addExpenseToStore(emptyStore, {
      ...draft,
      dueDay: 10,
      startDate: "2026-06-10",
    });
    const occurrence = {
      ...occurrenceFrom(added),
      id: `${added.templates[0].id}:2026-06-10`,
      occurrenceDate: "2026-06-10",
      dueDate: "2026-06-10",
    };

    const seriesMoved = moveOccurrenceSeriesInStore(
      added,
      occurrence,
      "2026-06-14",
    );
    expect(seriesMoved.templates[0].dueDay).toBe(14);

    const oneOff = moveOccurrenceOnlyInStore(
      seriesMoved,
      occurrence,
      "2026-06-14",
      512,
    );

    expect(oneOff.templates[0].dueDay).toBe(10);
    expect(oneOff.overrides[0]).toMatchObject({
      templateId: occurrence.template.id,
      occurrenceDate: "2026-06-10",
      dueDate: "2026-06-14",
      sortOrder: 512,
      status: "due",
    });
  });

  it("normalizes estimated weekend charge dates from monthly expense edits", () => {
    const added = addExpenseToStore(emptyStore, {
      ...draft,
      name: "Dazn",
      dueDay: 13,
      startDate: "2026-06-13",
    });
    const template = added.templates[0];
    const updated = updateMonthlyExpenseOccurrenceInStore(added, {
      templateId: template.id,
      occurrenceDate: "2026-06-13",
      dueDate: "2026-06-15",
      name: "Dazn",
      amount: 15,
      categoryId: template.categoryId,
      status: "due",
    });

    expect(updated.overrides[0]).toMatchObject({
      templateId: template.id,
      occurrenceDate: "2026-06-13",
      status: "due",
    });
    expect(updated.overrides[0].dueDate).toBeUndefined();
  });
});
