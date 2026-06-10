"use client";

import type { ExpenseStore } from "@/domain/types";
import { demoStore } from "@/domain/seed";
import { defaultFinanceStore } from "@/domain/finance";

const STORAGE_KEY = "expense-reminders-store-v1";

function withDemoDefaults(store: ExpenseStore): ExpenseStore {
  if (store.templates.some((template) => template.id === "exp-electricity")) {
    return demoStore;
  }

  return {
    ...store,
    finance: store.finance ?? defaultFinanceStore,
    categories: [
      ...store.categories,
      ...demoStore.categories.filter(
        (category) =>
          !store.categories.some((existing) => existing.id === category.id),
      ),
    ],
    templates: [
      ...store.templates,
      ...demoStore.templates.filter(
        (template) =>
          !store.templates.some((existing) => existing.id === template.id),
      ),
    ],
  };
}

export function loadExpenseStore(): ExpenseStore {
  if (typeof window === "undefined") return demoStore;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return demoStore;

  try {
    return withDemoDefaults(JSON.parse(raw) as ExpenseStore);
  } catch {
    return demoStore;
  }
}

export function saveExpenseStore(store: ExpenseStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
      allocation: {
        ...cloudStore.finance?.allocation,
        ...localStore.finance?.allocation,
      },
      incomeSources: mergeById(
        cloudStore.finance?.incomeSources ?? [],
        localStore.finance?.incomeSources ?? [],
      ),
      incomeEvents: mergeById(
        cloudStore.finance?.incomeEvents ?? [],
        localStore.finance?.incomeEvents ?? [],
      ),
    },
  };
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}
