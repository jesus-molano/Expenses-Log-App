"use client";

import { emptyStore } from "@/domain/seed";
import { emptyFinanceStore } from "@/domain/finance";
import type { ExpenseStore } from "@/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function withStoreDefaults(store: Partial<ExpenseStore>): ExpenseStore {
  return {
    categories: store.categories ?? [],
    templates: store.templates ?? [],
    overrides: store.overrides ?? [],
    finance: {
      incomeEvents: store.finance?.incomeEvents ?? [],
      monthlySalary: store.finance?.monthlySalary ?? {},
      monthlySavingsTargets: store.finance?.monthlySavingsTargets ?? {},
      accounts: store.finance?.accounts?.length
        ? store.finance.accounts
        : emptyFinanceStore.accounts,
    },
    preferences: {
      theme: store.preferences?.theme ?? "dark",
      language: store.preferences?.language ?? "es",
    },
  };
}

export function loadExpenseStore(): ExpenseStore {
  try {
    if (typeof window === "undefined" || !window.localStorage) return emptyStore;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;

    return withStoreDefaults(JSON.parse(raw) as Partial<ExpenseStore>);
  } catch {
    return emptyStore;
  }
}

export function saveExpenseStore(store: ExpenseStore): void {
  try {
    if (!window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event("expense-store-updated"));
  } catch {
    window.dispatchEvent(new Event("expense-store-updated"));
  }
}

export function clearExpenseLocalData(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("expense-store-updated"));
  } catch {
    window.dispatchEvent(new Event("expense-store-updated"));
  }
}

export function mergeExpenseStores(
  localStore: ExpenseStore,
  cloudStore: ExpenseStore | null,
): ExpenseStore {
  if (!cloudStore) return localStore;

  return {
    categories: mergeById(cloudStore.categories, localStore.categories),
    templates: mergeById(cloudStore.templates, localStore.templates),
    overrides: mergeById(cloudStore.overrides, localStore.overrides),
    finance: {
      incomeEvents: mergeById(
        cloudStore.finance.incomeEvents,
        localStore.finance.incomeEvents,
      ),
      monthlySalary: {
        ...cloudStore.finance.monthlySalary,
        ...localStore.finance.monthlySalary,
      },
      monthlySavingsTargets: {
        ...cloudStore.finance.monthlySavingsTargets,
        ...localStore.finance.monthlySavingsTargets,
      },
      accounts: localStore.finance.accounts.length
        ? localStore.finance.accounts
        : cloudStore.finance.accounts,
    },
    preferences: {
      theme: localStore.preferences?.theme ?? cloudStore.preferences?.theme ?? "dark",
      language:
        localStore.preferences?.language ??
        cloudStore.preferences?.language ??
        "es",
    },
  };
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}
