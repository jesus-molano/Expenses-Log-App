"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useState,
} from "react";
import type {
  AppLanguage,
  AppTheme,
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import { emptyStore } from "@/domain/seed";
import { materializeClosedOccurrenceRecords } from "@/domain/finance";
import { persistLanguagePreference, t } from "@/shared/i18n";
import { applyAppTheme } from "@/shared/theme";
import {
  addExpenseToStore,
  addIncomeEventToStore,
  clearExpensesFromStore,
  clearIncomeFromStore,
  deleteExpenseFromStore,
  deleteIncomeEventFromStore,
  dismissLastChanceReminderInStore,
  moveOccurrenceInStore,
  moveOccurrenceOnlyInStore,
  moveOccurrenceSeriesInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
  updateIncomeEventInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateMonthlyExpenseOccurrenceInStore,
  updateMonthlySalaryInStore,
  updateMonthlySavingsContributionInStore,
  updateMonthlySavingsTargetInStore,
  updateThemeInStore,
} from "./store-commands";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlyExpenseOverrideInput,
  MonthlySalaryInput,
  MonthlySavingsContributionInput,
  MonthlySavingsTargetInput,
} from "./store-types";
import { preserveClosedOccurrenceRecords } from "./store-history";
import { useStorePersistence } from "./use-store-persistence";

type ExpenseStoreContextValue = ReturnType<typeof useExpenseStoreValue>;

const ExpenseStoreContext = createContext<ExpenseStoreContextValue | null>(null);

export function ExpenseStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useExpenseStoreValue();

  return createElement(
    ExpenseStoreContext.Provider,
    { value },
    value.isHydrated
      ? createElement(
          "div",
          { className: "app-hydrated-content", "data-state": "ready" },
          children,
        )
      : null,
  );
}

export function useExpenseStore() {
  const context = useContext(ExpenseStoreContext);

  if (!context) {
    throw new Error("useExpenseStore must be used within ExpenseStoreProvider.");
  }

  return context;
}

function useExpenseStoreValue() {
  const [store, setStore] = useState<ExpenseStore>(emptyStore);
  const hydrateStore = useCallback((nextStore: ExpenseStore) => {
    setStore(nextStore);
  }, []);
  const persistence = useStorePersistence({ onHydrate: hydrateStore });

  function persist(nextStore: ExpenseStore) {
    persistence.persist(
      preserveClosedOccurrenceRecords(store, nextStore),
      setStore,
    );
  }

  function addExpense(draft: DraftExpense, options: CreateExpenseOptions = {}) {
    persist(addExpenseToStore(store, draft, options));
  }

  async function deleteExpense(templateId: string) {
    const recordedStore = materializeClosedOccurrenceRecords(store);
    await persistence.persistImmediately(
      deleteExpenseFromStore(recordedStore, templateId),
      setStore,
      t("settings.savingChanges"),
    );
  }

  async function clearExpenses() {
    const occurrenceRecordIds = (store.occurrenceRecords ?? []).map(
      (record) => record.id,
    );
    const clearedStore = clearExpensesFromStore(store);
    await persistence.persistImmediately(
      {
        ...clearedStore,
        schemaVersion: 3,
        occurrenceRecords: [],
        deleted: {
          ...clearedStore.deleted,
          occurrenceRecords: Array.from(
            new Set([
              ...(clearedStore.deleted?.occurrenceRecords ?? []),
              ...occurrenceRecordIds,
            ]),
          ),
        },
      },
      setStore,
      t("settings.clearingCloudExpenses"),
    );
  }

  async function clearIncome() {
    await persistence.persistImmediately(
      clearIncomeFromStore(store),
      setStore,
      t("settings.clearingCloudIncome"),
    );
  }

  function togglePaid(occurrence: ExpenseOccurrence) {
    persist(togglePaidInStore(store, occurrence));
  }

  function skipOccurrence(occurrence: ExpenseOccurrence) {
    persist(skipOccurrenceInStore(store, occurrence));
  }

  function dismissLastChanceReminder(occurrence: ExpenseOccurrence) {
    persist(dismissLastChanceReminderInStore(store, occurrence));
  }

  function moveOccurrence(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    persist(moveOccurrenceInStore(store, occurrence, dueDate, sortOrder));
  }

  function moveOccurrenceSeries(occurrence: ExpenseOccurrence, dueDate: string) {
    persist(moveOccurrenceSeriesInStore(store, occurrence, dueDate));
  }

  function moveOccurrenceOnly(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    persist(moveOccurrenceOnlyInStore(store, occurrence, dueDate, sortOrder));
  }

  function updateMoneySettings(input: MoneySettingsInput) {
    persist(updateMoneySettingsInStore(store, input));
  }

  function updateMonthlySavingsTarget(input: MonthlySavingsTargetInput) {
    persist(updateMonthlySavingsTargetInStore(store, input));
  }

  function updateMonthlySavingsContribution(
    input: MonthlySavingsContributionInput,
  ) {
    persist(updateMonthlySavingsContributionInStore(store, input));
  }

  function updateMonthlySalary(input: MonthlySalaryInput) {
    persist(updateMonthlySalaryInStore(store, input));
  }

  function addIncomeEvent(input: IncomeEventInput) {
    persist(addIncomeEventToStore(store, input));
  }

  function deleteIncomeEvent(eventId: string) {
    persist(deleteIncomeEventFromStore(store, eventId));
  }

  function updateIncomeEvent(eventId: string, input: IncomeEventInput) {
    persist(updateIncomeEventInStore(store, eventId, input));
  }

  function updateMonthlyExpenseOccurrence(input: MonthlyExpenseOverrideInput) {
    persist(updateMonthlyExpenseOccurrenceInStore(store, input));
  }

  function updateTheme(theme: AppTheme) {
    applyAppTheme(theme);
    persist(updateThemeInStore(store, theme));
  }

  function updateLanguage(language: AppLanguage) {
    persistLanguagePreference(language);
    persist(updateLanguageInStore(store, language));
  }

  return {
    store,
    persist,
    addExpense,
    deleteExpense,
    clearExpenses,
    clearIncome,
    togglePaid,
    skipOccurrence,
    dismissLastChanceReminder,
    moveOccurrence,
    moveOccurrenceSeries,
    moveOccurrenceOnly,
    updateMoneySettings,
    updateMonthlySavingsTarget,
    updateMonthlySavingsContribution,
    updateMonthlySalary,
    addIncomeEvent,
    deleteIncomeEvent,
    updateIncomeEvent,
    updateMonthlyExpenseOccurrence,
    updateTheme,
    updateLanguage,
    syncStatus: persistence.syncStatus,
    syncMessage: persistence.syncMessage,
    isHydrated: persistence.isHydrated,
  };
}
