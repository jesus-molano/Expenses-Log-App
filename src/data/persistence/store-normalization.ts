import { emptyFinanceStore } from "@/domain/finance";
import type { ExpenseStore, FinanceStore } from "@/domain/types";
import { normalizeAppLanguage } from "@/shared/i18n";
import { normalizeAppTheme } from "@/shared/theme";

const STORE_KEYS = [
  "categories",
  "templates",
  "overrides",
  "finance",
  "preferences",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordOrEmpty<T>(value: unknown): Record<string, T> {
  return isRecord(value) ? (value as Record<string, T>) : {};
}

function normalizeFinanceStore(value: unknown): FinanceStore {
  const finance = isRecord(value) ? value : {};
  const accounts = Array.isArray(finance.accounts)
    ? (finance.accounts as FinanceStore["accounts"])
    : [];

  return {
    incomeEvents: Array.isArray(finance.incomeEvents)
      ? (finance.incomeEvents as FinanceStore["incomeEvents"])
      : [],
    monthlySalary: recordOrEmpty(finance.monthlySalary),
    monthlySavingsTargets: recordOrEmpty(finance.monthlySavingsTargets),
    accounts: accounts.length ? accounts : emptyFinanceStore.accounts,
  };
}

export function normalizeExpenseStore(value: unknown): ExpenseStore {
  const store = isRecord(value) ? value : {};
  const preferences = isRecord(store.preferences) ? store.preferences : {};

  return {
    categories: Array.isArray(store.categories)
      ? (store.categories as ExpenseStore["categories"])
      : [],
    templates: Array.isArray(store.templates)
      ? (store.templates as ExpenseStore["templates"])
      : [],
    overrides: Array.isArray(store.overrides)
      ? (store.overrides as ExpenseStore["overrides"])
      : [],
    finance: normalizeFinanceStore(store.finance),
    preferences: {
      theme: normalizeAppTheme(preferences.theme),
      language: normalizeAppLanguage(preferences.language),
    },
  };
}

export function normalizeImportedExpenseStore(value: unknown): ExpenseStore {
  if (!isRecord(value) || !STORE_KEYS.some((key) => key in value)) {
    throw new Error("Invalid expense store export.");
  }

  return normalizeExpenseStore(value);
}
