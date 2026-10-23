"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useState,
  useRef,
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
  addExpensesToStore,
  addIncomeEventToStore,
  clearExpensesFromStore,
  clearIncomeFromStore,
  closeMonthInStore,
  deleteExpenseFromStore,
  deleteIncomeEventFromStore,
  dismissLastChanceReminderInStore,
  moveOccurrenceInStore,
  moveOccurrenceOnlyInStore,
  moveOccurrenceSeriesInStore,
  reopenMonthInStore,
  restoreOccurrenceInStore,
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
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
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
      : fallback,
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
  // Último store guardado. Los comandos parten siempre de él: un handler
  // creado en un render anterior (la acción de un aviso, un temporizador) no
  // debe deshacer lo que pasó después.
  const storeRef = useRef(store);
  const commitStore = useCallback((nextStore: ExpenseStore) => {
    storeRef.current = nextStore;
    setStore(nextStore);
  }, []);
  const persistence = useStorePersistence({ onHydrate: commitStore });

  function current() {
    return storeRef.current;
  }

  function persist(nextStore: ExpenseStore) {
    persistence.persist(
      preserveClosedOccurrenceRecords(current(), nextStore),
      commitStore,
    );
  }

  function addExpense(draft: DraftExpense, options: CreateExpenseOptions = {}) {
    persist(addExpenseToStore(current(), draft, options));
  }

  function addExpenses(drafts: DraftExpense[], options: CreateExpenseOptions = {}) {
    persist(addExpensesToStore(current(), drafts, options));
  }

  async function deleteExpense(templateId: string) {
    const recordedStore = materializeClosedOccurrenceRecords(current());
    await persistence.persistImmediately(
      deleteExpenseFromStore(recordedStore, templateId),
      commitStore,
      t("settings.savingChanges"),
    );
  }

  async function clearExpenses() {
    const occurrenceRecordIds = (current().occurrenceRecords ?? []).map(
      (record) => record.id,
    );
    const clearedStore = clearExpensesFromStore(current());
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
      commitStore,
      t("settings.clearingCloudExpenses"),
    );
  }

  async function clearIncome() {
    await persistence.persistImmediately(
      clearIncomeFromStore(current()),
      commitStore,
      t("settings.clearingCloudIncome"),
    );
  }

  function togglePaid(occurrence: ExpenseOccurrence) {
    persist(togglePaidInStore(current(), occurrence));
  }

  function skipOccurrence(occurrence: ExpenseOccurrence) {
    persist(skipOccurrenceInStore(current(), occurrence));
  }

  function restoreOccurrence(occurrence: ExpenseOccurrence) {
    persist(restoreOccurrenceInStore(current(), occurrence));
  }

  function dismissLastChanceReminder(occurrence: ExpenseOccurrence) {
    persist(dismissLastChanceReminderInStore(current(), occurrence));
  }

  function moveOccurrence(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    persist(moveOccurrenceInStore(current(), occurrence, dueDate, sortOrder));
  }

  function moveOccurrenceSeries(occurrence: ExpenseOccurrence, dueDate: string) {
    persist(moveOccurrenceSeriesInStore(current(), occurrence, dueDate));
  }

  function moveOccurrenceOnly(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    persist(moveOccurrenceOnlyInStore(current(), occurrence, dueDate, sortOrder));
  }

  function updateMoneySettings(input: MoneySettingsInput) {
    persist(updateMoneySettingsInStore(current(), input));
  }

  function updateMonthlySavingsTarget(input: MonthlySavingsTargetInput) {
    persist(updateMonthlySavingsTargetInStore(current(), input));
  }

  function updateMonthlySavingsContribution(
    input: MonthlySavingsContributionInput,
  ) {
    persist(updateMonthlySavingsContributionInStore(current(), input));
  }

  function updateMonthlySalary(input: MonthlySalaryInput) {
    persist(updateMonthlySalaryInStore(current(), input));
  }

  function addIncomeEvent(input: IncomeEventInput) {
    persist(addIncomeEventToStore(current(), input));
  }

  function deleteIncomeEvent(eventId: string) {
    persist(deleteIncomeEventFromStore(current(), eventId));
  }

  function updateIncomeEvent(eventId: string, input: IncomeEventInput) {
    persist(updateIncomeEventInStore(current(), eventId, input));
  }

  function updateMonthlyExpenseOccurrence(input: MonthlyExpenseOverrideInput) {
    persist(updateMonthlyExpenseOccurrenceInStore(current(), input));
  }

  function closeMonth(monthId: string) {
    persist(closeMonthInStore(current(), monthId));
  }

  function reopenMonth(monthId: string) {
    persist(reopenMonthInStore(current(), monthId));
  }

  function updateTheme(theme: AppTheme) {
    applyAppTheme(theme);
    persist(updateThemeInStore(current(), theme));
  }

  function updateLanguage(language: AppLanguage) {
    persistLanguagePreference(language);
    persist(updateLanguageInStore(current(), language));
  }

  return {
    store,
    persist,
    addExpense,
    addExpenses,
    deleteExpense,
    clearExpenses,
    clearIncome,
    togglePaid,
    skipOccurrence,
    restoreOccurrence,
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
    closeMonth,
    reopenMonth,
    updateTheme,
    updateLanguage,
    syncStatus: persistence.syncStatus,
    syncMessage: persistence.syncMessage,
    isHydrated: persistence.isHydrated,
  };
}
