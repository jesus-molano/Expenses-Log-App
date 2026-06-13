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
  const deleted = mergeDeletedIds(
    normalizedCloudStore.deleted,
    normalizedLocalStore.deleted,
  );

  return {
    categories: mergeById(
      normalizedCloudStore.categories,
      normalizedLocalStore.categories,
      deleted.categories,
    ),
    templates: mergeById(
      normalizedCloudStore.templates,
      normalizedLocalStore.templates,
      deleted.templates,
    ),
    overrides: mergeById(
      normalizedCloudStore.overrides,
      normalizedLocalStore.overrides,
      deleted.overrides,
    ),
    finance: {
      incomeEvents: mergeById(
        normalizedCloudStore.finance.incomeEvents,
        normalizedLocalStore.finance.incomeEvents,
        deleted.incomeEvents,
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
    bankMovements: mergeById(
      normalizedCloudStore.bankMovements,
      normalizedLocalStore.bankMovements,
      deleted.bankMovements,
    ),
    bankMerchantAliases: mergeAliases(
      normalizedCloudStore.bankMerchantAliases,
      normalizedLocalStore.bankMerchantAliases,
      deleted.bankMerchantAliases,
    ),
    deleted,
  };
}

function mergeById<T extends { id: string }>(
  base: T[],
  incoming: T[],
  deletedIds: string[] = [],
): T[] {
  const deleted = new Set(deletedIds);
  const map = new Map<string, T>();
  for (const item of base) {
    if (!deleted.has(item.id)) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (!deleted.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function mergeDeletedIds(
  base: ExpenseStore["deleted"],
  incoming: ExpenseStore["deleted"],
): NonNullable<ExpenseStore["deleted"]> {
  return {
    categories: mergeIdLists(base?.categories, incoming?.categories),
    templates: mergeIdLists(base?.templates, incoming?.templates),
    overrides: mergeIdLists(base?.overrides, incoming?.overrides),
    incomeEvents: mergeIdLists(base?.incomeEvents, incoming?.incomeEvents),
    bankMovements: mergeIdLists(base?.bankMovements, incoming?.bankMovements),
    bankMerchantAliases: mergeIdLists(
      base?.bankMerchantAliases,
      incoming?.bankMerchantAliases,
    ),
  };
}

function mergeIdLists(
  base: string[] | undefined,
  incoming: string[] | undefined,
): string[] {
  return Array.from(new Set([...(base ?? []), ...(incoming ?? [])]));
}

function mergeAliases(
  base: ExpenseStore["bankMerchantAliases"],
  incoming: ExpenseStore["bankMerchantAliases"],
  deletedIds: string[] = [],
): ExpenseStore["bankMerchantAliases"] {
  const deleted = new Set(deletedIds);
  const byRelationship = new Map<string, ExpenseStore["bankMerchantAliases"][number]>();

  for (const alias of [...base, ...incoming]) {
    if (deleted.has(alias.id)) continue;
    byRelationship.set(`${alias.templateId}:${alias.merchantKey}`, alias);
  }

  return Array.from(byRelationship.values());
}
