"use client";

import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { normalizeExpenseStore } from "./store-normalization";

const STORAGE_KEY = "expense-log-store-v1";

export function loadExpenseStore(): ExpenseStore {
  try {
    if (typeof window === "undefined" || !window.localStorage) return emptyStore;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;

    return normalizeExpenseStore(JSON.parse(raw));
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
  const normalizedLocalStore = normalizeExpenseStore(localStore);
  const normalizedCloudStore = normalizeExpenseStore(cloudStore);

  // Best-effort whole-store merge: local values win, but deletes are not
  // conflict-safe across devices without per-entity tombstones or revisions.
  return {
    categories: mergeById(
      normalizedCloudStore.categories,
      normalizedLocalStore.categories,
    ),
    templates: mergeById(
      normalizedCloudStore.templates,
      normalizedLocalStore.templates,
    ),
    overrides: mergeById(
      normalizedCloudStore.overrides,
      normalizedLocalStore.overrides,
    ),
    finance: {
      incomeEvents: mergeById(
        normalizedCloudStore.finance.incomeEvents,
        normalizedLocalStore.finance.incomeEvents,
      ),
      monthlySalary: {
        ...normalizedCloudStore.finance.monthlySalary,
        ...normalizedLocalStore.finance.monthlySalary,
      },
      monthlySavingsTargets: {
        ...normalizedCloudStore.finance.monthlySavingsTargets,
        ...normalizedLocalStore.finance.monthlySavingsTargets,
      },
      accounts: normalizedLocalStore.finance.accounts.length
        ? normalizedLocalStore.finance.accounts
        : normalizedCloudStore.finance.accounts,
    },
    preferences: {
      theme:
        normalizedLocalStore.preferences?.theme ??
        normalizedCloudStore.preferences?.theme ??
        "dark",
      language:
        normalizedLocalStore.preferences?.language ??
        normalizedCloudStore.preferences?.language ??
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
