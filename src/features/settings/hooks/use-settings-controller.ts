"use client";

import { useMemo, useState } from "react";
import { configuredPayday } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import { resolveReminderPreferences } from "@/domain/reminder-schedule";
import type { AppLanguage } from "@/domain/types";
import { clearDeviceData } from "@/data/persistence/device-data";
import { readSyncMeta } from "@/data/persistence/sync-meta-store";
import { appTabHref, appTabLabelKey, type AppTab } from "@/shared/app-tabs";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { t } from "@/shared/i18n";
import { DEFAULT_THEME } from "@/shared/theme";
import type { ReminderPreferencesInput } from "@/stores/app/store-commands";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { createClient } from "@/utils/supabase/client";
import { useNotificationSettings } from "./use-notification-settings";
import { reloadHome, useSettingsAuth, type SignOutOptions } from "./use-settings-auth";
import { describeBudgetCycle } from "../lib/budget-cycle-options";
import { releasePushSubscription } from "../lib/push-notifications";
import { deviceTimeZone } from "../lib/reminder-options";
import { SETTINGS_LANGUAGES, SETTINGS_THEMES } from "../lib/settings-options";

export function useSettingsController({
  from = "expenses",
}: {
  from?: AppTab;
} = {}) {
  const expenseStore = useExpenseStore();
  const {
    store,
    syncStatus,
    syncMessage,
    updateTheme,
    updateLanguage,
    updateBudgetCycle,
    updateReminderPreferences,
    clearExpenses,
    clearIncome,
  } = expenseStore;
  const [message, setMessage] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [budgetCycleOpen, setBudgetCycleOpen] = useState(false);
  const [clearExpensesOpen, setClearExpensesOpen] = useState(false);
  const [isClearingExpenses, setIsClearingExpenses] = useState(false);
  const [clearIncomeOpen, setClearIncomeOpen] = useState(false);
  const [isClearingIncome, setIsClearingIncome] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutHasPendingChanges, setSignOutHasPendingChanges] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const { user, setUser, isSigningOut, signOut } = useSettingsAuth(
    supabase,
    setMessage,
  );
  const {
    notificationState,
    notificationHealth,
    notificationsActive,
    isTestingNotification,
    lastTestSentAt,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    refreshNotificationState,
  } = useNotificationSettings(setMessage);

  const currentTheme = store.preferences?.theme ?? DEFAULT_THEME;
  const currentLanguage = store.preferences?.language ?? "es";
  const selectedTheme =
    SETTINGS_THEMES.find((theme) => theme.id === currentTheme) ??
    SETTINGS_THEMES[0];
  const languageLabel =
    SETTINGS_LANGUAGES.find((language) => language.id === currentLanguage)
      ?.label ?? SETTINGS_LANGUAGES[0].label;
  const todayDateOnly = toDateOnly(useCurrentDate());
  const budgetCycle = useMemo(
    () => describeBudgetCycle(store.finance, todayDateOnly, currentLanguage),
    [currentLanguage, store.finance, todayDateOnly],
  );
  // Atrás vuelve a la pestaña desde la que se abrió Ajustes.
  const backHref = appTabHref(from);
  const backLabel = t(appTabLabelKey(from), currentLanguage);
  const deleteAccountPhrase = t("settings.deleteAccountPhrase", currentLanguage);
  const reminderPreferences = resolveReminderPreferences(store);
  const hasPayday =
    configuredPayday(store.finance, toDateOnly(new Date()).slice(0, 7)) !== null;

  // La hora de los avisos se interpreta en la zona del dispositivo que la
  // eligió: se guarda con cada cambio.
  function saveReminderPreferences(changes: ReminderPreferencesInput) {
    updateReminderPreferences({ ...changes, timeZone: deviceTimeZone() });
  }

  async function handleClearExpenses() {
    setIsClearingExpenses(true);
    try {
      await clearExpenses();
      setClearExpensesOpen(false);
      setMessage(t("settings.expensesCleared"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.clearExpensesError"),
      );
    } finally {
      setIsClearingExpenses(false);
    }
  }

  async function handleClearIncome() {
    setIsClearingIncome(true);
    try {
      await clearIncome();
      setClearIncomeOpen(false);
      setMessage(t("settings.incomeCleared"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("settings.clearIncomeError"),
      );
    } finally {
      setIsClearingIncome(false);
    }
  }

  // Al abrir se mira si quedan cambios sin subir: si se borran los datos del
  // dispositivo, se perderían.
  function openSignOutDialog() {
    setSignOutHasPendingChanges(readSyncMeta().dirty);
    setSignOutOpen(true);
  }

  function closeSignOutDialog() {
    if (isSigningOut) return;
    setSignOutOpen(false);
  }

  async function handleSignOut(options: SignOutOptions) {
    const signedOut = await signOut(options);
    if (!signedOut) return;
    setSignOutOpen(false);
    void refreshNotificationState();
  }

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      if (!response.ok) {
        throw new Error(t("settings.deleteAccountError"));
      }

      // Las filas push ya se borraron en cascada; queda anular la
      // suscripción del navegador para que la siguiente cuenta no la herede.
      await releasePushSubscription();
      await supabase?.auth.signOut();
      // Las copias automáticas también: llevan los datos de la cuenta borrada.
      await clearDeviceData();
      setUser(null);
      // Reload the document to discard the deleted account's in-memory store.
      reloadHome();
    } catch {
      setMessage(t("settings.deleteAccountError"));
      setIsDeletingAccount(false);
    }
  }

  function closeDeleteAccountDialog() {
    if (isDeletingAccount) return;
    setDeleteAccountOpen(false);
  }

  return {
    store,
    user,
    syncStatus,
    syncMessage,
    message,
    themeOpen,
    languageOpen,
    budgetCycleOpen,
    budgetCycle,
    clearExpensesOpen,
    isClearingExpenses,
    clearIncomeOpen,
    isClearingIncome,
    deleteAccountOpen,
    isDeletingAccount,
    signOutOpen,
    signOutHasPendingChanges,
    isSigningOut,
    currentTheme,
    currentLanguage: currentLanguage as AppLanguage,
    selectedTheme,
    languageLabel,
    backHref,
    backLabel,
    deleteAccountPhrase,
    notificationState,
    notificationHealth,
    notificationsActive,
    isTestingNotification,
    lastTestSentAt,
    reminderPreferences,
    hasPayday,
    updateReminderPreferences: saveReminderPreferences,
    setThemeOpen,
    setLanguageOpen,
    setBudgetCycleOpen,
    setClearExpensesOpen,
    setClearIncomeOpen,
    setDeleteAccountOpen,
    updateTheme,
    updateLanguage,
    updateBudgetCycle,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    openSignOutDialog,
    closeSignOutDialog,
    handleSignOut,
    handleClearExpenses,
    handleClearIncome,
    handleDeleteAccount,
    closeDeleteAccountDialog,
  };
}

export function syncDescription(status: string, message: string) {
  if (status === "syncing") return t("settings.syncing");
  if (status === "synced") return message;
  if (status === "pending") return t("settings.pendingSync");
  if (status === "error") return `${t("settings.cloudError")}: ${message}`;
  return t("settings.localChanges");
}
