import { emptyFinanceStore } from "@/domain/finance";
import type { ExpenseStore, FinanceStore } from "@/domain/types";
import { normalizeAppLanguage } from "@/shared/i18n";
import { normalizeAppTheme } from "@/shared/theme";

const STORE_KEYS = [
  "categories",
  "templates",
  "overrides",
  "finance",
  "bankMovements",
  "bankMerchantAliases",
  "deleted",
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

function normalizeDeletedIds(value: unknown): NonNullable<ExpenseStore["deleted"]> {
  const deleted = isRecord(value) ? value : {};

  return {
    categories: stringArray(deleted.categories),
    templates: stringArray(deleted.templates),
    overrides: stringArray(deleted.overrides),
    incomeEvents: stringArray(deleted.incomeEvents),
    bankMovements: stringArray(deleted.bankMovements),
    bankMerchantAliases: stringArray(deleted.bankMerchantAliases),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string")))
    : [];
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
    bankMovements: Array.isArray(store.bankMovements)
      ? (store.bankMovements as ExpenseStore["bankMovements"])
      : [],
    bankMerchantAliases: Array.isArray(store.bankMerchantAliases)
      ? (store.bankMerchantAliases as ExpenseStore["bankMerchantAliases"])
      : [],
    deleted: normalizeDeletedIds(store.deleted),
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

export function assignExpenseStoreOwner(
  store: ExpenseStore,
  userId: string | null | undefined,
): ExpenseStore {
  if (!userId) return store;

  return {
    ...store,
    categories: store.categories.map((category) => ({
      ...category,
      userId,
    })),
    templates: store.templates.map((template) => ({
      ...template,
      userId,
    })),
    overrides: store.overrides.map((override) => ({
      ...override,
      userId,
    })),
    finance: {
      ...store.finance,
      incomeEvents: store.finance.incomeEvents.map((event) => ({
        ...event,
        userId,
      })),
    },
    bankMovements: store.bankMovements.map((movement) => ({
      ...movement,
      userId,
    })),
    bankMerchantAliases: store.bankMerchantAliases.map((alias) => ({
      ...alias,
      userId,
    })),
  };
}
