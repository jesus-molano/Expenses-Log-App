"use client";

import type { ExpenseStore } from "@/domain/types";
import { demoStore } from "@/domain/seed";

const STORAGE_KEY = "expense-reminders-store-v1";

export function loadExpenseStore(): ExpenseStore {
  if (typeof window === "undefined") return demoStore;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return demoStore;

  try {
    return JSON.parse(raw) as ExpenseStore;
  } catch {
    return demoStore;
  }
}

export function saveExpenseStore(store: ExpenseStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
