"use client";

import { useMemo, useState } from "react";
import { configuredPayday } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import { resolveReminderPreferences } from "@/domain/reminder-schedule";
import type { AppLanguage } from "@/domain/types";
import { clearExpenseLocalData } from "@/data/persistence/local-store";
import { t } from "@/shared/i18n";
import { DEFAULT_THEME } from "@/shared/theme";
import type { ReminderPreferencesInput } from "@/stores/app/store-commands";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { createClient } from "@/utils/supabase/client";
import { useNotificationSettings } from "./use-notification-settings";
import { useSettingsAuth } from "./use-settings-auth";
import { deviceTimeZone } from "../lib/reminder-options";
import { SETTINGS_LANGUAGES, SETTINGS_THEMES } from "../lib/settings-options";

export function useSettingsController({
  from = "expenses",
}: {
  from?: "money" | "expenses";
} = {}) {
  const expenseStore = useExpenseStore();
  const {
    store,
    syncStatus,
    syncMessage,
    updateTheme,
    updateLanguage,
    updateReminderPreferences,
    clearExpenses,
    clearIncome,
  } = expenseStore;
  const [message, setMessage] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [clearExpensesOpen, setClearExpensesOpen] = useState(false);
  const [isClearingExpenses, setIsClearingExpenses] = useState(false);
  const [clearIncomeOpen, setClearIncomeOpen] = useState(false);
  const [isClearingIncome, setIsClearingIncome] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const { user, setUser, signOut } = useSettingsAuth(supabase, setMessage);
  const {
    notificationState,
    notificationHealth,
    notificationsActive,
    isTestingNotification,
    lastTestSentAt,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  } = useNotificationSettings(setMessage);

  const currentTheme = store.preferences?.theme ?? DEFAULT_THEME;
  const currentLanguage = store.preferences?.language ?? "es";
  const selectedTheme =
    SETTINGS_THEMES.find((theme) => theme.id === currentTheme) ??
    SETTINGS_THEMES[0];
  const languageLabel =
    SETTINGS_LANGUAGES.find((language) => language.id === currentLanguage)
      ?.label ?? SETTINGS_LANGUAGES[0].label;
  const backTab = from === "money" ? "money" : "expenses";
  const backHref = backTab === "money" ? "/money" : "/";
  const backLabel =
    backTab === "money" ? t("common.plan") : t("common.expenses");
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

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      if (!response.ok) {
        throw new Error(t("settings.deleteAccountError"));
      }

      await supabase?.auth.signOut();
      clearExpenseLocalData();
      setUser(null);
      // Reload the document to discard the deleted account's in-memory store.
      window.location.replace("/");
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
    clearExpensesOpen,
    isClearingExpenses,
    clearIncomeOpen,
    isClearingIncome,
    deleteAccountOpen,
    isDeletingAccount,
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
    setClearExpensesOpen,
    setClearIncomeOpen,
    setDeleteAccountOpen,
    updateTheme,
    updateLanguage,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    signOut,
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
