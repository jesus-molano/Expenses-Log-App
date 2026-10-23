"use client";

import { useMemo, useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { clearExpenseLocalData } from "@/data/persistence/local-store";
import { readSyncMeta } from "@/data/persistence/sync-meta-store";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { t } from "@/shared/i18n";
import { DEFAULT_THEME } from "@/shared/theme";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { createClient } from "@/utils/supabase/client";
import { useNotificationSettings } from "./use-notification-settings";
import { useSettingsAuth, type SignOutOptions } from "./use-settings-auth";
import { describeBudgetCycle } from "../lib/budget-cycle-options";
import { releasePushSubscription } from "../lib/push-notifications";
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
    updateBudgetCycle,
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
  const backTab = from === "money" ? "money" : "expenses";
  const backHref = backTab === "money" ? "/money" : "/";
  const backLabel =
    backTab === "money" ? t("common.plan") : t("common.expenses");
  const deleteAccountPhrase = t("settings.deleteAccountPhrase", currentLanguage);

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
