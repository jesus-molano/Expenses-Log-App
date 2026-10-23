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
  BudgetCycleAnchor,
  CreateExpenseOptions,
  DraftExpense,
  ExpenseAmountChange,
  ExpenseOccurrence,
  ExpensePause,
  ExpenseReminderSettings,
  ExpenseStore,
} from "@/domain/types";
import { emptyStore } from "@/domain/seed";
import { materializeClosedOccurrenceRecords } from "@/domain/finance";
import type { SnapshotReason } from "@/data/persistence/snapshot-policy";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import { persistLanguagePreference, t } from "@/shared/i18n";
import { applyAppTheme } from "@/shared/theme";
import {
  addExpenseToStore,
  addExpensesToStore,
  applyCaptureCommandsInStore,
  addIncomeEventToStore,
  clearExpensesFromStore,
  clearIncomeFromStore,
  closeMonthInStore,
  createCategoryInStore,
  deleteBalanceCheckinInStore,
  deleteCategoryInStore,
  deleteExpenseFromStore,
  deleteIncomeEventFromStore,
  dismissLastChanceReminderInStore,
  endSeriesInStore,
  importStoreInStore,
  markOccurrencesPaidInStore,
  moveOccurrenceInStore,
  moveOccurrenceOnlyInStore,
  moveOccurrenceSeriesInStore,
  pauseSeriesInStore,
  reactivateSeriesInStore,
  recordBalanceInStore,
  recordSalaryReceiptInStore,
  removeAmountChangeInStore,
  removePauseInStore,
  reopenMonthInStore,
  restoreOccurrenceInStore,
  resumeSeriesInStore,
  revertCaptureCommandsInStore,
  scheduleAmountChangeInStore,
  setSeriesAmountInStore,
  setTemplateReminderInStore,
  skipOccurrenceInStore,
  payOccurrenceInStore,
  togglePaidInStore,
  undoSalaryReceiptInStore,
  updateBudgetCycleInStore,
  updateCategoryInStore,
  updateIncomeEventInStore,
  updateLanguageInStore,
  updateMoneySettingsInStore,
  updateMonthlyExpenseOccurrenceInStore,
  updateMonthlySalaryInStore,
  updateMonthlySavingsContributionInStore,
  updateMonthlySavingsTargetInStore,
  updateReminderPreferencesInStore,
  updateSalaryExtraPayInStore,
  updateThemeInStore,
  type ReminderPreferencesInput,
  type SeriesAmountScope,
} from "./store-commands";
import type { ImportMode, ImportScope } from "./backup-commands";
import type {
  CaptureCommandChange,
  ConfirmedCaptureCommand,
} from "./capture-command-actions";
import type { CategoryInput } from "./category-commands";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlyExpenseOverrideInput,
  MonthlySalaryInput,
  MonthlySavingsContributionInput,
  MonthlySavingsTargetInput,
  SalaryExtraPayInput,
  SalaryReceiptInput,
} from "./store-types";
import { preserveClosedOccurrenceRecords } from "./store-history";
import { useStorePersistence } from "./use-store-persistence";
import { useStoreSnapshots } from "./use-store-snapshots";

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
  const getStore = useCallback(() => storeRef.current, []);
  const { captureSnapshot } = useStoreSnapshots({
    isHydrated: persistence.isHydrated,
    getStore,
  });

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
    await captureSnapshot(current(), "before-clear");
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
    await captureSnapshot(current(), "before-clear");
    await persistence.persistImmediately(
      clearIncomeFromStore(current()),
      commitStore,
      t("settings.clearingCloudIncome"),
    );
  }

  function togglePaid(occurrence: ExpenseOccurrence) {
    persist(togglePaidInStore(current(), occurrence));
  }

  function payOccurrence(occurrence: ExpenseOccurrence, amountPaid: number) {
    persist(payOccurrenceInStore(current(), occurrence, amountPaid));
  }

  function skipOccurrence(occurrence: ExpenseOccurrence) {
    persist(skipOccurrenceInStore(current(), occurrence));
  }

  function restoreOccurrence(occurrence: ExpenseOccurrence) {
    persist(restoreOccurrenceInStore(current(), occurrence));
  }

  function markOccurrencesPaid(occurrences: ExpenseOccurrence[]) {
    persist(markOccurrencesPaidInStore(current(), occurrences));
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

  function setTemplateReminder(
    templateId: string,
    reminder: ExpenseReminderSettings | undefined,
  ) {
    persist(setTemplateReminderInStore(current(), templateId, reminder));
  }

  function updateReminderPreferences(changes: ReminderPreferencesInput) {
    persist(updateReminderPreferencesInStore(current(), changes));
  }

  function setSeriesAmount(
    templateId: string,
    amount: number,
    scope: SeriesAmountScope = "current",
  ) {
    persist(setSeriesAmountInStore(current(), templateId, amount, { scope }));
  }

  function scheduleAmountChange(templateId: string, change: ExpenseAmountChange) {
    persist(scheduleAmountChangeInStore(current(), templateId, change));
  }

  function removeAmountChange(templateId: string, from: string) {
    persist(removeAmountChangeInStore(current(), templateId, from));
  }

  function endSeries(templateId: string, lastChargeDate: string) {
    persist(endSeriesInStore(current(), templateId, lastChargeDate));
  }

  function reactivateSeries(templateId: string) {
    persist(reactivateSeriesInStore(current(), templateId));
  }

  function pauseSeries(templateId: string, pause: ExpensePause) {
    persist(pauseSeriesInStore(current(), templateId, pause));
  }

  function resumeSeries(templateId: string) {
    persist(resumeSeriesInStore(current(), templateId));
  }

  function removePause(templateId: string, from: string) {
    persist(removePauseInStore(current(), templateId, from));
  }

  function updateSalaryExtraPay(input: SalaryExtraPayInput) {
    persist(updateSalaryExtraPayInStore(current(), input));
  }

  function recordSalaryReceipt(input: SalaryReceiptInput) {
    persist(recordSalaryReceiptInStore(current(), input));
  }

  function undoSalaryReceipt(monthId: string) {
    persist(undoSalaryReceiptInStore(current(), monthId));
  }

  // Devuelve el id de la categoría (la existente si ya había una con ese
  // nombre) o null si el nombre no es válido.
  function createCategory(input: CategoryInput): string | null {
    const result = createCategoryInStore(current(), input);
    if (result.store !== current()) persist(result.store);
    return result.categoryId;

  function updateCategory(categoryId: string, changes: Partial<CategoryInput>) {
    persist(updateCategoryInStore(current(), categoryId, changes));

  function deleteCategory(categoryId: string, replacementName: string) {
    persist(deleteCategoryInStore(current(), categoryId, replacementName));

  // Órdenes de la captura ya confirmadas. Devuelve lo necesario para
  // deshacerlas.
  function applyCaptureCommands(commands: ConfirmedCaptureCommand[]): CaptureCommandChange[] {
    const result = applyCaptureCommandsInStore(current(), commands);
    if (result.changes.length) persist(result.store);
    return result.changes;

  function revertCaptureCommands(changes: CaptureCommandChange[]) {
    if (changes.length) persist(revertCaptureCommandsInStore(current(), changes));
  }

  function closeMonth(monthId: string) {
    persist(closeMonthInStore(current(), monthId));
  }

  function reopenMonth(monthId: string) {
    persist(reopenMonthInStore(current(), monthId));
  }

  // Importar y restaurar guardan antes una copia de lo actual, que se puede
  // restaurar desde Ajustes si el resultado no es el esperado.
  async function importStore(
    imported: ExpenseStore,
    options: { mode: ImportMode; scope: ImportScope },
  ) {
    await captureSnapshot(current(), "before-import");
    await persistence.persistImmediately(
      importStoreInStore(current(), imported, options),
      commitStore,
      t("backup.importing"),
    );
  }

  async function restoreSnapshot(snapshotStore: ExpenseStore) {
    await captureSnapshot(current(), "before-restore");
    await persistence.persistImmediately(
      importStoreInStore(current(), normalizeExpenseStore(snapshotStore), {
        mode: "replace",
        scope: "all",
      }),
      commitStore,
      t("backup.restoring"),
    );
  }

  function takeSnapshot(reason: SnapshotReason = "manual") {
    return captureSnapshot(current(), reason);
  }

  function updateBudgetCycle(anchor: BudgetCycleAnchor) {
    persist(updateBudgetCycleInStore(current(), anchor));
  }

  function recordBalance(input: { date: string; amount: number }) {
    persist(recordBalanceInStore(current(), input));
  }

  function deleteBalanceCheckin(date: string) {
    persist(deleteBalanceCheckinInStore(current(), date));
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
    payOccurrence,
    skipOccurrence,
    restoreOccurrence,
    markOccurrencesPaid,
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
    setTemplateReminder,
    updateReminderPreferences,
    setSeriesAmount,
    scheduleAmountChange,
    removeAmountChange,
    endSeries,
    reactivateSeries,
    pauseSeries,
    resumeSeries,
    removePause,
    updateSalaryExtraPay,
    recordSalaryReceipt,
    undoSalaryReceipt,
    createCategory,
    updateCategory,
    deleteCategory,
    applyCaptureCommands,
    revertCaptureCommands,
    closeMonth,
    reopenMonth,
    importStore,
    restoreSnapshot,
    takeSnapshot,
    updateBudgetCycle,
    recordBalance,
    deleteBalanceCheckin,
    updateTheme,
    updateLanguage,
    syncStatus: persistence.syncStatus,
    syncMessage: persistence.syncMessage,
    isHydrated: persistence.isHydrated,
  };
}
