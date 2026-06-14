import { emptyFinanceStore } from "@/domain/finance";
import { buildDateWithDay, toDateOnly } from "@/domain/calendar";
import { generateTemplateDates } from "@/domain/recurrence";
import type {
  BankMerchantAlias,
  BankMovement,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  FinanceStore,
} from "@/domain/types";
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

  return normalizeImportedPaidOccurrenceDates({
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
        ...paidOverridesFromImportedPastOccurrences(store, templatesById),
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

function paidOverridesFromImportedPastOccurrences(
  store: ExpenseStore,
  templatesById: Map<string, ExpenseTemplate>,
): ExpenseOccurrenceOverride[] {
  const today = toDateOnly(new Date());
  const yesterday = previousDate(today);
  if (yesterday < "1900-01-01") return [];

  return store.bankMerchantAliases.flatMap((alias) => {
    const template = templatesById.get(alias.templateId);
    if (!template) return [];

    return generateTemplateDates(template, template.startDate, yesterday).map(
      (occurrenceDate) =>
        paidOverrideFromImportedAlias(template, alias, occurrenceDate),
    );
  });
}

function paidOverrideFromImportedAlias(
  template: ExpenseTemplate,
  alias: BankMerchantAlias,
  occurrenceDate: string,
): ExpenseOccurrenceOverride {
  return {
    id: `ovr-import-alias-${template.id}-${occurrenceDate}`,
    userId: template.userId,
    templateId: template.id,
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T12:00:00.000Z`,
    amountPaid: template.amount,
    note: `Conciliado desde importacion bancaria: ${alias.label}`,
  };
}

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - 1);
  return toDateOnly(value);
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
