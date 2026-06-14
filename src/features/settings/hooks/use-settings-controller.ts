"use client";

import { useMemo, useState } from "react";
import type { AppLanguage } from "@/domain/types";
import { clearExpenseLocalData } from "@/data/persistence/local-store";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { createClient } from "@/utils/supabase/client";
import { useNotificationSettings } from "./use-notification-settings";
import { useSettingsAuth } from "./use-settings-auth";
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
    notificationsActive,
    enableNotifications,
    disableNotifications,
  } = useNotificationSettings(setMessage);

  const currentTheme = store.preferences?.theme ?? "dark";
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
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? t("settings.deleteAccountError"));
      }

      await supabase?.auth.signOut();
      clearExpenseLocalData();
      setUser(null);
      window.location.assign("/");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.deleteAccountError"),
      );
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
    notificationsActive,
    setThemeOpen,
    setLanguageOpen,
    setClearExpensesOpen,
    setClearIncomeOpen,
    setDeleteAccountOpen,
    updateTheme,
    updateLanguage,
    enableNotifications,
    disableNotifications,
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
  if (status === "error") return `${t("settings.cloudError")}: ${message}`;
  return t("settings.localChanges");
}
