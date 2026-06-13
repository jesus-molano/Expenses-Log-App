import { describe, expect, it, vi } from "vitest";
import { PLAN_ACCOUNT_NAME_MAX_LENGTH } from "@/domain/plan-accounts";
import { emptyStore } from "@/domain/seed";
import type {
  BankMovement,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import {
  addExpenseToStore,
  clearExpensesFromStore,
  confirmBankImportInStore,
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

function movement(overrides: Partial<BankMovement> = {}): BankMovement {
  return {
    id: overrides.id ?? "mov-1",
    userId: "demo",
    fingerprint: overrides.fingerprint ?? "fingerprint-1",
    bookedAt: overrides.bookedAt ?? "2026-06-01",
    description: overrides.description ?? "APPLE.COM/BILL",
    amount: overrides.amount ?? -30,
    currency: "EUR",
    merchantKey: overrides.merchantKey ?? "apple",
    importBatchId: overrides.importBatchId ?? "batch-1",
    createdAt: overrides.createdAt ?? "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

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

  it("confirms a bank match as a paid occurrence and saves an alias", () => {
    const added = addExpenseToStore(emptyStore, draft);
    const template = added.templates[0];
    const importedMovement = movement();

    const confirmed = confirmBankImportInStore(added, {
      decisions: [
        {
          candidateId: "candidate-1",
          action: "match",
          movements: [importedMovement],
          templateId: template.id,
          occurrenceDate: "2026-06-01",
          alias: {
            merchantKey: "apple",
            label: "APPLE.COM/BILL",
            templateId: template.id,
          },
        },
      ],
    });

    expect(confirmed.overrides[0]).toMatchObject({
      templateId: template.id,
      occurrenceDate: "2026-06-01",
      status: "paid",
      amountPaid: 30,
    });
    expect(confirmed.bankMovements[0]).toMatchObject({
      fingerprint: importedMovement.fingerprint,
      matchedTemplateId: template.id,
      matchedOccurrenceDate: "2026-06-01",
    });
    expect(confirmed.bankMerchantAliases[0]).toMatchObject({
      merchantKey: "apple",
      templateId: template.id,
      label: "APPLE.COM/BILL",
    });
  });

  it("confirms grouped bank matches as separate paid occurrences", () => {
    const added = addExpenseToStore(emptyStore, {
      ...draft,
      name: "Dazn",
      amount: 14.99,
      startDate: "2026-05-13",
      dueDay: 13,
    });
    const template = added.templates[0];
    const mayMovement = movement({
      id: "mov-dazn-may",
      fingerprint: "fingerprint-dazn-may",
      bookedAt: "2026-05-13",
      description: "COMPRA TARJ. WWW.DAZN.COM-Madrid",
      amount: -14.99,
      merchantKey: "dazn",
    });
    const juneMovement = movement({
      id: "mov-dazn-june",
      fingerprint: "fingerprint-dazn-june",
      bookedAt: "2026-06-15",
      description: "COMPRA TARJ. WWW.DAZN.COM-Madrid",
      amount: -14.99,
      merchantKey: "dazn",
    });

    const confirmed = confirmBankImportInStore(added, {
      decisions: [
        {
          candidateId: "candidate-dazn",
          action: "match",
          movements: [mayMovement, juneMovement],
          templateId: template.id,
          occurrenceDate: "2026-06-13",
          movementMatches: [
            {
              movementId: mayMovement.id,
              occurrenceDate: "2026-05-13",
            },
            {
              movementId: juneMovement.id,
              occurrenceDate: "2026-06-13",
            },
          ],
        },
      ],
    });

    expect(confirmed.overrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: template.id,
          occurrenceDate: "2026-05-13",
          status: "paid",
          paidAt: "2026-05-13T12:00:00.000Z",
        }),
        expect.objectContaining({
          templateId: template.id,
          occurrenceDate: "2026-06-13",
          status: "paid",
          paidAt: "2026-06-15T12:00:00.000Z",
        }),
      ]),
    );
    expect(confirmed.bankMovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fingerprint: mayMovement.fingerprint,
          matchedOccurrenceDate: "2026-05-13",
        }),
        expect.objectContaining({
          fingerprint: juneMovement.fingerprint,
          matchedOccurrenceDate: "2026-06-13",
        }),
      ]),
    );
  });

  it("creates a new expense from a confirmed bank candidate only when requested", () => {
    const importedMovement = movement({
      id: "mov-openai",
      fingerprint: "fingerprint-openai",
      description: "OPENAI API",
      amount: -20,
      merchantKey: "openai",
    });

    const ignored = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "candidate-ignore",
          action: "ignore",
          movements: [importedMovement],
        },
      ],
    });
    const created = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "candidate-create",
          action: "create",
          movements: [importedMovement],
          expense: {
            ...draft,
            name: "OpenAI",
            amount: 20,
            categoryName: "Suscripciones",
            startDate: "2026-06-01",
          },
        },
      ],
    });

    expect(ignored.templates).toHaveLength(0);
    expect(created.templates[0]).toMatchObject({
      name: "OpenAI",
      amount: 20,
    });
    expect(created.overrides[0]).toMatchObject({
      templateId: created.templates[0].id,
      status: "paid",
      amountPaid: 20,
    });
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
