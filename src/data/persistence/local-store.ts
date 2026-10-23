"use client";

import { isSalaryCleared } from "@/domain/finance";
import { dedupeOverrides } from "@/domain/overrides";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { latestUpdated, mergeLatestById } from "./merge-by-id";
import {
  DELETED_KEYS,
  FINANCE_KEYS,
  PREFERENCE_KEYS,
  STORE_KEYS,
  normalizeExpenseStore,
  unknownEntries,
  withMonthClosures,
} from "./store-normalization";
import { SYNC_META_KEY } from "./sync-meta-store";

const STORAGE_KEY = "expense-log-store-v1";

export function loadExpenseStore(): ExpenseStore {
  let raw: string | null = null;
  try {
    if (typeof window === "undefined" || !window.localStorage) return emptyStore;

    raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;

    return normalizeExpenseStore(JSON.parse(raw));
  } catch {
    // La app guarda el store normalizado justo después de cargarlo: sin esta
    // copia, unos datos ilegibles se perderían al sobrescribirlos con uno vacío.
    if (raw) backupCorruptStore(raw);
    return emptyStore;
  }
}

const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}.corrupt`;

// Una sola copia (la última): varias acabarían llenando localStorage.
function backupCorruptStore(raw: string) {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Sin espacio para la copia no hay nada más que hacer sin bloquear la app.
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

// Borra los datos de gastos de este dispositivo y sus metadatos de sync: sin
// datos, un dueño o unos cambios pendientes antiguos no significan nada.
export function clearExpenseLocalData(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SYNC_META_KEY);
    // También las copias con fecha que guardaban builds anteriores.
    const storage = window.localStorage;
    Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(CORRUPT_BACKUP_KEY)))
      .forEach((key) => storage.removeItem(key));
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
    ...mergeUnknownEntries(normalizedCloudStore, normalizedLocalStore, STORE_KEYS),
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
    // Por ocurrencia: el estado de la versión que lo cambió más tarde y el
    // resto de la última edición (`pickWinningOverride`).
    overrides: dedupeOverrides(
      [...normalizedCloudStore.overrides, ...normalizedLocalStore.overrides],
      deleted.overrides,
    ),
    occurrenceRecords: mergeLatestById(
      normalizedCloudStore.occurrenceRecords ?? [],
      normalizedLocalStore.occurrenceRecords ?? [],
      deleted.occurrenceRecords,
    ),
    finance: {
      ...mergeUnknownEntries(
        normalizedCloudStore.finance,
        normalizedLocalStore.finance,
        FINANCE_KEYS,
      ),
      incomeEvents: mergeLatestById(
        normalizedCloudStore.finance.incomeEvents,
        normalizedLocalStore.finance.incomeEvents,
        deleted.incomeEvents,
      ),
      monthlySalary: mergeSalaryRecord(
        normalizedCloudStore.finance.monthlySalary,
        normalizedLocalStore.finance.monthlySalary,
        deleted.monthlySalary,
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
      ...withMonthClosures(
        mergeMonthlyRecord(
          normalizedCloudStore.finance.monthClosures,
          normalizedLocalStore.finance.monthClosures,
        ),
      ),
    },
    preferences: {
      ...mergeUnknownEntries(
        normalizedCloudStore.preferences,
        normalizedLocalStore.preferences,
        PREFERENCE_KEYS,
      ),
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
    ...mergeUnknownEntries(base, incoming, DELETED_KEYS),
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
    monthlySalary: mergeIdLists(base?.monthlySalary, incoming?.monthlySalary),
  };
}

// Fusiona claves que este build no conoce sin interpretarlas: registros por
// entrada con el updatedAt más reciente, listas de ids por unión y, en otro
// caso, gana el valor local.
function mergeUnknownEntries(
  cloud: unknown,
  local: unknown,
  knownKeys: readonly string[],
): Record<string, unknown> {
  const result = unknownEntries(cloud, knownKeys);

  for (const [key, value] of Object.entries(unknownEntries(local, knownKeys))) {
    const existing = result[key];
    if (isPlainRecord(existing) && isPlainRecord(value)) {
      result[key] = mergeMonthlyRecord(existing, value);
    } else if (isStringList(existing) && isStringList(value)) {
      result[key] = mergeIdLists(existing, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

function mergeSalaryRecord(
  cloud: ExpenseStore["finance"]["monthlySalary"] | undefined,
  local: ExpenseStore["finance"]["monthlySalary"] | undefined,
  tombstones: string[] = [],
) {
  return Object.fromEntries(
    Object.entries(mergeMonthlyRecord(cloud, local)).filter(
      ([monthId, salary]) =>
        !isSalaryCleared(tombstones, monthId, salary.updatedAt ?? ""),
    ),
  );
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
