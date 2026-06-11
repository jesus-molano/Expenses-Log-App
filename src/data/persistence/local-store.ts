"use client";

import type { ExpenseStore } from "@/domain/types";
import { emptyStore } from "@/domain/seed";
import { emptyFinanceStore, toMonthId } from "@/domain/finance";
import type { AllocationSettings, FinanceStore } from "@/domain/types";

const STORAGE_KEY = "expense-reminders-store-v3";
const LEGACY_STORAGE_KEYS = [
  "expense-reminders-store-v1",
  "expense-reminders-store-v2",
];

function purgeLegacyLocalStores() {
  if (typeof window === "undefined" || !window.localStorage) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function normalizeAllocationSettings(
  allocation?: Partial<AllocationSettings> | null,
): AllocationSettings {
  const monthlySavingsTargets = normalizeMonthlySavingsTargets(
    allocation?.monthlySavingsTargets,
  );
  if (
    allocation?.monthlySavingsTarget !== undefined &&
    Object.keys(monthlySavingsTargets).length === 0
  ) {
    monthlySavingsTargets[toMonthId(new Date())] = Math.max(
      Number(allocation.monthlySavingsTarget),
      0,
    );
  }

  return {
    expensesAccountName:
      allocation?.expensesAccountName ??
      emptyFinanceStore.allocation.expensesAccountName,
    savingsAccountName:
      allocation?.savingsAccountName ??
      emptyFinanceStore.allocation.savingsAccountName,
    primaryAccountName:
      allocation?.primaryAccountName ??
      emptyFinanceStore.allocation.primaryAccountName,
    monthlySavingsTargets,
  };
}

function normalizeMonthlySavingsTargets(
  targets?: Record<string, number> | null,
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [monthId, amount] of Object.entries(targets ?? {})) {
    if (/^\d{4}-\d{2}$/.test(monthId)) {
      normalized[monthId] = Math.max(Number(amount), 0);
    }
  }
  return normalized;
}

function normalizeFinanceStore(finance?: Partial<FinanceStore> | null): FinanceStore {
  return {
    incomeSources: finance?.incomeSources ?? [],
    incomeEvents: finance?.incomeEvents ?? [],
    allocation: normalizeAllocationSettings(
      finance?.allocation,
    ),
  };
}

function withStoreDefaults(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    categories: store.categories ?? [],
    templates: store.templates ?? [],
    overrides: store.overrides ?? [],
    finance: normalizeFinanceStore(store.finance),
    preferences: {
      theme: store.preferences?.theme ?? "legacy",
      language: store.preferences?.language ?? "es",
    },
  };
}

export function loadExpenseStore(): ExpenseStore {
  try {
    if (typeof window === "undefined" || !window.localStorage) return emptyStore;
    purgeLegacyLocalStores();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;

    return withStoreDefaults(JSON.parse(raw) as ExpenseStore);
  } catch {
    return emptyStore;
  }
}

export function saveExpenseStore(store: ExpenseStore): void {
  try {
    if (!window.localStorage) return;
    purgeLegacyLocalStores();
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
    purgeLegacyLocalStores();
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
      allocation: normalizeAllocationSettings({
        ...cloudStore.finance?.allocation,
        ...localStore.finance?.allocation,
        monthlySavingsTargets: {
          ...cloudStore.finance?.allocation?.monthlySavingsTargets,
          ...localStore.finance?.allocation?.monthlySavingsTargets,
        },
      }),
      incomeSources: mergeById(
        cloudStore.finance?.incomeSources ?? [],
        localStore.finance?.incomeSources ?? [],
      ),
      incomeEvents: mergeById(
        cloudStore.finance?.incomeEvents ?? [],
        localStore.finance?.incomeEvents ?? [],
      ),
    },
    preferences: {
      theme:
        localStore.preferences?.theme ??
        cloudStore.preferences?.theme ??
        "legacy",
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
