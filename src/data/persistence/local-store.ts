"use client";

import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { latestUpdated, mergeLatestById } from "./merge-by-id";
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
    schemaVersion: 3,
    categories: mergeLatestById(
      normalizedCloudStore.categories,
      normalizedLocalStore.categories,
      deleted.categories,
    ),
    templates: mergeLatestById(
      normalizedCloudStore.templates,
      normalizedLocalStore.templates,
      deleted.templates,
    ),
    overrides: mergeLatestById(
      normalizedCloudStore.overrides,
      normalizedLocalStore.overrides,
      deleted.overrides,
    ),
    occurrenceRecords: mergeLatestById(
      normalizedCloudStore.occurrenceRecords ?? [],
      normalizedLocalStore.occurrenceRecords ?? [],
      deleted.occurrenceRecords,
    ),
    finance: {
      incomeEvents: mergeLatestById(
        normalizedCloudStore.finance.incomeEvents,
        normalizedLocalStore.finance.incomeEvents,
        deleted.incomeEvents,
      ),
      monthlySalary: mergeMonthlyRecord(
        normalizedCloudStore.finance.monthlySalary,
        normalizedLocalStore.finance.monthlySalary,
      ),
      monthlySavingsTargets: mergeMonthlyRecord(
        normalizedCloudStore.finance.monthlySavingsTargets,
        normalizedLocalStore.finance.monthlySavingsTargets,
      ),
      monthlySavingsContributions: mergeContributionRecord(
        normalizedCloudStore.finance.monthlySavingsContributions,
        normalizedLocalStore.finance.monthlySavingsContributions,
        deleted.savingsContributions,
      ),
    },
    preferences: {
      theme:
        normalizedLocalStore.preferences?.theme ??
        normalizedCloudStore.preferences?.theme ??
        "vice-afterglow",
      language:
        normalizedLocalStore.preferences?.language ??
        normalizedCloudStore.preferences?.language ??
        "es",
    },
    deleted,
  };
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
    occurrenceRecords: mergeIdLists(
      base?.occurrenceRecords,
      incoming?.occurrenceRecords,
    ),
    savingsContributions: mergeIdLists(
      base?.savingsContributions,
      incoming?.savingsContributions,
    ),
  };
}

function mergeIdLists(
  base: string[] | undefined,
  incoming: string[] | undefined,
): string[] {
  return Array.from(new Set([...(base ?? []), ...(incoming ?? [])]));
}

function mergeMonthlyRecord<T>(
  cloud: Record<string, T> | undefined,
  local: Record<string, T> | undefined,
): Record<string, T> {
  const result = { ...(cloud ?? {}) };
  for (const [monthId, value] of Object.entries(local ?? {})) {
    result[monthId] = latestUpdated(result[monthId], value);
  }
  return result;
}

function mergeContributionRecord(
  cloud: NonNullable<ExpenseStore["finance"]["monthlySavingsContributions"]> | undefined,
  local: NonNullable<ExpenseStore["finance"]["monthlySavingsContributions"]> | undefined,
  deletedIds: string[] = [],
) {
  const deleted = new Set(deletedIds);
  return Object.fromEntries(
    Object.entries(mergeMonthlyRecord(cloud, local)).filter(
      ([, contribution]) => !deleted.has(contribution.id),
    ),
  );
}
