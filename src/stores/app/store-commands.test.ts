import { describe, expect, it, vi } from "vitest";
import { PLAN_ACCOUNT_NAME_MAX_LENGTH } from "@/domain/plan-accounts";
import { generateOccurrences } from "@/domain/recurrence";
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
  clearIncomeFromStore,
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
        accounts: [
          {
            id: "acct-main",
            name: "Principal",
            purposes: ["salary", "daily"],
          },
        ],
      },
      bankMovements: [
        movement({ id: "expense-mov", amount: -30 }),
        movement({
          id: "income-mov",
          amount: 45,
          matchedIncomeEventId: "income-1",
        }),
        movement({
          id: "salary-mov",
          amount: 2200,
          matchedSalaryMonth: "2026-06",
        }),
      ],
    };

    const cleared = clearIncomeFromStore(incomeStore);

    expect(cleared.finance.incomeEvents).toEqual([]);
    expect(cleared.finance.monthlySalary).toEqual({});
    expect(cleared.finance.monthlySavingsTargets).toEqual(
      incomeStore.finance.monthlySavingsTargets,
    );
    expect(cleared.finance.accounts).toEqual(incomeStore.finance.accounts);
    expect(cleared.categories).toEqual(incomeStore.categories);
    expect(cleared.templates).toEqual(incomeStore.templates);
    expect(cleared.overrides).toEqual(incomeStore.overrides);
    expect(cleared.bankMovements).toEqual([
      expect.objectContaining({ id: "expense-mov" }),
    ]);
    expect(cleared.deleted?.incomeEvents).toContain("income-1");
    expect(cleared.deleted?.bankMovements).toEqual(
      expect.arrayContaining(["income-mov", "salary-mov"]),
    );
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

  it("imports a bank movement without linking it when explicitly requested", () => {
    const importedMovement = movement({
      id: "mov-raw",
      fingerprint: "fingerprint-raw",
      description: "MOVIMIENTO DUPLICADO REVISADO",
    });

    const confirmed = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "candidate-duplicate",
          action: "import",
          movements: [importedMovement],
        },
      ],
    });

    expect(confirmed.bankMovements).toEqual([importedMovement]);
    expect(confirmed.templates).toEqual(emptyStore.templates);
    expect(confirmed.overrides).toEqual(emptyStore.overrides);
    expect(confirmed.finance).toEqual(emptyStore.finance);
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
      paidAt: "2026-06-01T12:00:00.000Z",
      amountPaid: 20,
    });
  });

  it("creates imported recurring expenses as paid on their generated occurrence date", () => {
    const importedMovement = movement({
      id: "mov-weekend-shifted",
      fingerprint: "fingerprint-weekend-shifted",
      bookedAt: "2026-06-15",
      description: "DAZN",
      amount: -14.99,
      merchantKey: "dazn",
    });

    const confirmed = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "candidate-create-shifted",
          action: "create",
          movements: [importedMovement],
          expense: {
            ...draft,
            name: "Dazn",
            amount: 14.99,
            categoryName: "Suscripciones",
            startDate: "2026-06-13",
            dueDay: 13,
            recurrence: { frequency: "monthly" },
          },
        },
      ],
    });
    const [occurrence] = generateOccurrences(
      confirmed.templates,
      confirmed.overrides,
      "2026-06-01",
      "2026-06-30",
    );

    expect(confirmed.overrides[0]).toMatchObject({
      templateId: confirmed.templates[0].id,
      occurrenceDate: "2026-06-13",
      status: "paid",
      paidAt: "2026-06-15T12:00:00.000Z",
      amountPaid: 14.99,
    });
    expect(confirmed.bankMovements[0]).toMatchObject({
      matchedTemplateId: confirmed.templates[0].id,
      matchedOccurrenceDate: "2026-06-13",
    });
    expect(occurrence).toMatchObject({
      occurrenceDate: "2026-06-13",
      status: "paid",
    });
  });

  it("confirms imported salary movements into monthly salary settings", () => {
    const maySalary = movement({
      id: "mov-salary-may",
      fingerprint: "fingerprint-salary-may",
      bookedAt: "2026-05-28",
      description: "NOMINA EMPRESA ACME",
      amount: 2200,
      merchantKey: "nomina empresa acme",
    });
    const juneSalary = movement({
      id: "mov-salary-june",
      fingerprint: "fingerprint-salary-june",
      bookedAt: "2026-06-29",
      description: "NOMINA EMPRESA ACME",
      amount: 2200,
      merchantKey: "nomina empresa acme",
    });

    const confirmed = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "income-salary",
          action: "salary",
          movements: [maySalary, juneSalary],
          salary: {
            amount: 2200,
            dayOfMonth: 28,
          },
          salaryMatches: [
            {
              movementId: maySalary.id,
              monthId: "2026-05",
            },
            {
              movementId: juneSalary.id,
              monthId: "2026-06",
            },
          ],
        },
      ],
    });

    expect(confirmed.finance.monthlySalary).toMatchObject({
      "2026-05": {
        amount: 2200,
        dayOfMonth: 28,
      },
      "2026-06": {
        amount: 2200,
        dayOfMonth: 28,
      },
    });
    expect(confirmed.bankMovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fingerprint: maySalary.fingerprint,
          matchedSalaryMonth: "2026-05",
        }),
        expect.objectContaining({
          fingerprint: juneSalary.fingerprint,
          matchedSalaryMonth: "2026-06",
        }),
      ]),
    );
  });

  it("sums multiple confirmed salary payments in the same month", () => {
    const baseSalary = movement({
      id: "mov-base-salary",
      fingerprint: "fingerprint-base-salary",
      bookedAt: "2026-06-28",
      description: "NOMINA EMPRESA ACME",
      amount: 1800,
      merchantKey: "nomina empresa acme",
    });
    const bonusSalary = movement({
      id: "mov-bonus-salary",
      fingerprint: "fingerprint-bonus-salary",
      bookedAt: "2026-06-29",
      description: "NOMINA VARIABLE ACME",
      amount: 350.55,
      merchantKey: "nomina variable acme",
    });

    const withBaseSalary = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "income-salary-base",
          action: "salary",
          movements: [baseSalary],
          salary: {
            amount: 1800,
            dayOfMonth: 28,
          },
          salaryMatches: [
            {
              movementId: baseSalary.id,
              monthId: "2026-06",
            },
          ],
        },
      ],
    });
    const confirmed = confirmBankImportInStore(withBaseSalary, {
      decisions: [
        {
          candidateId: "income-salary-bonus",
          action: "salary",
          movements: [bonusSalary],
          salary: {
            amount: 350.55,
            dayOfMonth: 28,
          },
          salaryMatches: [
            {
              movementId: bonusSalary.id,
              monthId: "2026-06",
            },
          ],
        },
      ],
    });

    expect(confirmed.finance.monthlySalary["2026-06"]).toMatchObject({
      amount: 2150.55,
      dayOfMonth: 28,
    });
    expect(confirmed.bankMovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fingerprint: baseSalary.fingerprint,
          matchedSalaryMonth: "2026-06",
        }),
        expect.objectContaining({
          fingerprint: bonusSalary.fingerprint,
          matchedSalaryMonth: "2026-06",
        }),
      ]),
    );
  });

  it("confirms an imported positive movement as a one-off income event", () => {
    const importedMovement = movement({
      id: "mov-income",
      fingerprint: "fingerprint-income",
      bookedAt: "2026-06-02",
      description: "BIZUM JESUS",
      amount: 45,
      merchantKey: "bizum jesus",
    });

    const confirmed = confirmBankImportInStore(emptyStore, {
      decisions: [
        {
          candidateId: "income-once",
          action: "income",
          movements: [importedMovement],
          incomeEvent: {
            name: "Bizum Jesus",
            amount: 45,
            receivedAt: "2026-06-02",
            note: "BIZUM JESUS",
          },
        },
      ],
    });

    expect(confirmed.finance.incomeEvents[0]).toMatchObject({
      name: "Bizum Jesus",
      amount: 45,
      receivedAt: "2026-06-02",
      note: "BIZUM JESUS",
    });
    expect(confirmed.bankMovements[0]).toMatchObject({
      fingerprint: importedMovement.fingerprint,
      matchedIncomeEventId: confirmed.finance.incomeEvents[0].id,
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
