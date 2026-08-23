import {
  emptyFinanceStore,
  materializeClosedOccurrenceRecords,
  toMonthId,
} from "@/domain/finance";
import { buildDateWithDay, toDateOnly } from "@/domain/calendar";
import type {
  BankMovement,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  FinanceStore,
  MonthlySavingsContribution,
  MonthlySavingsTarget,
} from "@/domain/types";
import { normalizeAppLanguage } from "@/shared/i18n";
import { normalizeAppTheme } from "@/shared/theme";

const STORE_KEYS = [
  "categories",
  "schemaVersion",
  "templates",
  "overrides",
  "occurrenceRecords",
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

function normalizeFinanceStore(
  value: unknown,
  legacyStore: boolean,
  today: Date,
): FinanceStore {
  const finance = isRecord(value) ? value : {};
  const accounts = Array.isArray(finance.accounts)
    ? (finance.accounts as FinanceStore["accounts"])
    : [];

  const monthlySavingsTargets = normalizeSavingsTargets(
    finance.monthlySavingsTargets,
  );
  const monthlySavingsContributions = normalizeSavingsContributions(
    finance.monthlySavingsContributions,
  );

  if (legacyStore) {
    const currentMonthId = toMonthId(today);
    for (const [monthId, target] of Object.entries(monthlySavingsTargets)) {
      if (monthId > currentMonthId || monthlySavingsContributions[monthId]) {
        continue;
      }
      const amount = Math.max(target.amount, 0);
      if (amount <= 0) continue;
      const timestamp = target.updatedAt;
      monthlySavingsContributions[monthId] = {
        id: `saving:${monthId}`,
        userId: "demo",
        monthId,
        amount,
        source: "legacy",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }
  }

  return {
    incomeEvents: Array.isArray(finance.incomeEvents)
      ? (finance.incomeEvents as FinanceStore["incomeEvents"])
      : [],
    monthlySalary: normalizeMonthlySalary(finance.monthlySalary),
    monthlySavingsTargets,
    monthlySavingsContributions,
    accounts: accounts.length ? accounts : emptyFinanceStore.accounts,
  };
}

function normalizeMonthlySalary(
  value: unknown,
): FinanceStore["monthlySalary"] {
  return Object.fromEntries(
    Object.entries(recordOrEmpty<unknown>(value)).flatMap(([monthId, entry]) => {
      if (!/^\d{4}-\d{2}$/.test(monthId) || !isRecord(entry)) return [];
      return [
        [
          monthId,
          {
            amount: Math.max(Number(entry.amount ?? 0), 0),
            dayOfMonth: Math.min(
              Math.max(Number(entry.dayOfMonth ?? 28), 1),
              31,
            ),
            updatedAt:
              typeof entry.updatedAt === "string"
                ? entry.updatedAt
                : monthTimestamp(monthId),
          },
        ],
      ];
    }),
  );
}

function normalizeSavingsTargets(
  value: unknown,
): Record<string, MonthlySavingsTarget> {
  return Object.fromEntries(
    Object.entries(recordOrEmpty<unknown>(value)).flatMap(([monthId, entry]) => {
      if (!/^\d{4}-\d{2}$/.test(monthId)) return [];
      const amount =
        typeof entry === "number"
          ? entry
          : isRecord(entry)
            ? Number(entry.amount ?? 0)
            : 0;
      const updatedAt =
        isRecord(entry) && typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : monthTimestamp(monthId);
      return [[monthId, { amount: Math.max(Number(amount), 0), updatedAt }]];
    }),
  );
}

function normalizeSavingsContributions(
  value: unknown,
): Record<string, MonthlySavingsContribution> {
  return Object.fromEntries(
    Object.entries(recordOrEmpty<unknown>(value)).flatMap(([monthId, entry]) => {
      if (!/^\d{4}-\d{2}$/.test(monthId) || !isRecord(entry)) return [];
      const timestamp =
        typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : monthTimestamp(monthId);
      return [
        [
          monthId,
          {
            id:
              typeof entry.id === "string" ? entry.id : `saving:${monthId}`,
            userId:
              typeof entry.userId === "string" ? entry.userId : "demo",
            monthId,
            amount: Math.max(Number(entry.amount ?? 0), 0),
            transferredAt:
              typeof entry.transferredAt === "string"
                ? entry.transferredAt
                : undefined,
            source: entry.source === "legacy" ? "legacy" : "manual",
            createdAt:
              typeof entry.createdAt === "string"
                ? entry.createdAt
                : timestamp,
            updatedAt: timestamp,
          } satisfies MonthlySavingsContribution,
        ],
      ];
    }),
  );
}

function monthTimestamp(monthId: string) {
  return `${monthId}-01T00:00:00.000Z`;
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
    occurrenceRecords: stringArray(deleted.occurrenceRecords),
    savingsContributions: stringArray(deleted.savingsContributions),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string")))
    : [];
}

export function normalizeExpenseStore(
  value: unknown,
  today: Date = new Date(),
): ExpenseStore {
  const store = isRecord(value) ? value : {};
  const preferences = isRecord(store.preferences) ? store.preferences : {};
  const legacyStore = store.schemaVersion !== 2;

  const base: ExpenseStore = {
    schemaVersion: 2,
    categories: Array.isArray(store.categories)
      ? (store.categories as ExpenseStore["categories"])
      : [],
    templates: Array.isArray(store.templates)
      ? (store.templates as ExpenseStore["templates"])
      : [],
    overrides: Array.isArray(store.overrides)
      ? (store.overrides as ExpenseStore["overrides"])
      : [],
    occurrenceRecords: Array.isArray(store.occurrenceRecords)
      ? (store.occurrenceRecords as ExpenseStore["occurrenceRecords"])
      : [],
    finance: normalizeFinanceStore(store.finance, legacyStore, today),
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
  const normalized = legacyStore
    ? normalizeImportedPaidOccurrenceDates(base)
    : base;

  return materializeClosedOccurrenceRecords(normalized, {
    today,
    source: legacyStore ? "legacy-derived" : "native",
  });
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
      monthlySavingsContributions: Object.fromEntries(
        Object.entries(store.finance.monthlySavingsContributions ?? {}).map(
          ([monthId, contribution]) => [
            monthId,
            { ...contribution, userId },
          ],
        ),
      ),
    },
    occurrenceRecords: (store.occurrenceRecords ?? []).map((record) => ({
      ...record,
      userId,
    })),
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

function normalizeImportedPaidOccurrenceDates(store: ExpenseStore): ExpenseStore {
  const templatesById = new Map(store.templates.map((template) => [template.id, template]));
  const bankMovements = store.bankMovements.map((movement) =>
    normalizeMatchedBankMovementOccurrenceDate(movement, templatesById),
  );
  const importedMovementDatesByTemplate = new Map<string, Set<string>>();

  for (const movement of bankMovements) {
    if (!movement.matchedTemplateId) continue;
    const dates = importedMovementDatesByTemplate.get(movement.matchedTemplateId) ?? new Set();
    dates.add(movement.bookedAt);
    importedMovementDatesByTemplate.set(movement.matchedTemplateId, dates);
  }

  return {
    ...store,
    bankMovements,
    overrides: dedupeOverrides(
      [
        ...store.overrides.map((override) =>
          normalizeImportedOverrideOccurrenceDate(
            override,
            templatesById,
            importedMovementDatesByTemplate,
          ),
        ),
        ...bankMovements.flatMap((movement) =>
          paidOverrideFromMatchedBankMovement(movement, templatesById),
        ),
      ],
    ),
  };
}

function normalizeMatchedBankMovementOccurrenceDate(
  movement: BankMovement,
  templatesById: Map<string, ExpenseTemplate>,
): BankMovement {
  if (!movement.matchedTemplateId) return movement;

  const template = templatesById.get(movement.matchedTemplateId);
  if (!template) return movement;

  const expectedOccurrenceDate = occurrenceDateForImportedMovement(
    template,
    movement.bookedAt,
  );

  return movement.matchedOccurrenceDate === expectedOccurrenceDate
    ? movement
    : {
        ...movement,
        matchedOccurrenceDate: expectedOccurrenceDate,
      };
}

function normalizeImportedOverrideOccurrenceDate(
  override: ExpenseOccurrenceOverride,
  templatesById: Map<string, ExpenseTemplate>,
  importedMovementDatesByTemplate: Map<string, Set<string>>,
): ExpenseOccurrenceOverride {
  if (override.status !== "paid") return override;

  const template = templatesById.get(override.templateId);
  const bookedAt = override.paidAt?.slice(0, 10);
  if (!template || !bookedAt) return override;

  const isBankImportOverride =
    override.note?.toLowerCase().includes("importacion bancaria") ||
    override.note?.toLowerCase().includes("conciliado con") ||
    importedMovementDatesByTemplate.get(override.templateId)?.has(bookedAt);
  if (!isBankImportOverride) return override;

  const expectedOccurrenceDate = occurrenceDateForImportedMovement(template, bookedAt);
  return override.occurrenceDate === expectedOccurrenceDate
    ? override
    : {
        ...override,
        occurrenceDate: expectedOccurrenceDate,
      };
}

function paidOverrideFromMatchedBankMovement(
  movement: BankMovement,
  templatesById: Map<string, ExpenseTemplate>,
): ExpenseOccurrenceOverride[] {
  if (!movement.matchedTemplateId) return [];

  const template = templatesById.get(movement.matchedTemplateId);
  if (!template) return [];

  const occurrenceDate =
    movement.matchedOccurrenceDate ??
    occurrenceDateForImportedMovement(template, movement.bookedAt);

  return [
    {
      id: `ovr-import-${movement.fingerprint}`,
      userId: movement.userId,
      templateId: template.id,
      occurrenceDate,
      status: "paid",
      paidAt: `${movement.bookedAt}T12:00:00.000Z`,
      amountPaid: Math.abs(movement.amount),
      note: `Conciliado con ${movement.description}`,
    },
  ];
}

function occurrenceDateForImportedMovement(
  template: Pick<ExpenseTemplate, "dueDay" | "recurrence">,
  bookedAt: string,
) {
  if (
    template.recurrence.frequency === "once" ||
    (template.recurrence.frequency === "custom" &&
      ["day", "week"].includes(template.recurrence.unit ?? ""))
  ) {
    return bookedAt;
  }

  return toDateOnly(buildDateWithDay(new Date(`${bookedAt}T00:00:00`), template.dueDay));
}

function dedupeOverrides(overrides: ExpenseOccurrenceOverride[]) {
  const byKey = new Map<string, ExpenseOccurrenceOverride>();

  for (const override of overrides) {
    const key = `${override.templateId}:${override.occurrenceDate}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      (override.status === "paid" && existing.status !== "paid") ||
      isImportedPaidOverride(override)
    ) {
      byKey.set(key, override);
      continue;
    }
    if (existing.status === "paid" && override.status === "paid") {
      byKey.set(key, {
        ...existing,
        ...override,
        id: existing.id,
        paidAt: existing.paidAt ?? override.paidAt,
        amountPaid: existing.amountPaid ?? override.amountPaid,
      });
    }
  }

  return Array.from(byKey.values());
}

function isImportedPaidOverride(override: ExpenseOccurrenceOverride) {
  return (
    override.status === "paid" &&
    (override.id.startsWith("ovr-import-") ||
      override.note?.toLowerCase().includes("importacion bancaria") ||
      override.note?.toLowerCase().includes("conciliado con"))
  );
}
