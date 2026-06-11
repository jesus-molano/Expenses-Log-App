"use client";

import { useCallback, useState } from "react";
import { emptyStore } from "@/domain/seed";
import type {
  AppLanguage,
  AppTheme,
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import { persistLanguagePreference, t } from "@/shared/i18n";
import { applyAppTheme } from "@/shared/theme";
import {
  addExpenseToStore,
  addIncomeEventToStore,
  clearExpensesFromStore,
  deleteExpenseFromStore,
  deleteIncomeEventFromStore,
  moveOccurrenceInStore,
  moveOccurrenceSeriesInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateThemeInStore,
} from "./store-commands";
import type { IncomeEventInput, MoneySettingsInput } from "./store-types";
import { useStorePersistence } from "./use-store-persistence";

export function useExpenseStore() {
  const [store, setStore] = useState<ExpenseStore>(() => emptyStore);
  const hydrateStore = useCallback((nextStore: ExpenseStore) => {
    setStore(nextStore);
  }, []);
  const persistence = useStorePersistence({ onHydrate: hydrateStore });

  function persist(nextStore: ExpenseStore) {
    persistence.persist(nextStore, setStore);
  }

  function addExpense(draft: DraftExpense, options: CreateExpenseOptions = {}) {
    persist(addExpenseToStore(store, draft, options));
  }

  async function deleteExpense(templateId: string) {
    await persistence.persistImmediately(
      deleteExpenseFromStore(store, templateId),
      setStore,
      t("settings.savingChanges"),
    );
  }

  async function clearExpenses() {
    await persistence.persistImmediately(
      clearExpensesFromStore(store),
      setStore,
      t("settings.clearingCloudExpenses"),
    );
  }

  function togglePaid(occurrence: ExpenseOccurrence) {
    persist(togglePaidInStore(store, occurrence));
  }

  function skipOccurrence(occurrence: ExpenseOccurrence) {
    persist(skipOccurrenceInStore(store, occurrence));
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

  function updateMoneySettings(input: MoneySettingsInput) {
    persist(updateMoneySettingsInStore(store, input));
  }

  function addIncomeEvent(input: IncomeEventInput) {
    persist(addIncomeEventToStore(store, input));
  }

  function deleteIncomeEvent(eventId: string) {
    persist(deleteIncomeEventFromStore(store, eventId));
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
    togglePaid,
    skipOccurrence,
    moveOccurrence,
    moveOccurrenceSeries,
    updateMoneySettings,
    addIncomeEvent,
    deleteIncomeEvent,
    updateTheme,
    updateLanguage,
    syncStatus: persistence.syncStatus,
    syncMessage: persistence.syncMessage,
    isHydrated: persistence.isHydrated,
  };
}
