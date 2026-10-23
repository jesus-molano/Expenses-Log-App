import {
  materializeClosedOccurrenceRecords,
  toMonthId,
} from "@/domain/finance";
import {
  CATEGORY_NAME_MAX_LENGTH,
  CUSTOM_CATEGORY_ICON,
  findPresetCategory,
  isCategoryTone,
} from "@/domain/categories";
import { EXPENSE_DETAIL_KEYS, sanitizeExpenseDetails } from "@/domain/expense-details";
import { dedupeOverrides } from "@/domain/overrides";
import {
  buildDateWithDay,
  normalizeDateOnly,
  toDateOnly,
} from "@/domain/calendar";
import type {
  ExpenseCategory,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  FinanceStore,
  MonthClosure,
  MonthlySavingsContribution,
  MonthlySavingsTarget,
} from "@/domain/types";
import { normalizeAppLanguage } from "@/shared/i18n";
import { normalizeAppTheme } from "@/shared/theme";

export const STORE_KEYS = [
  "categories",
  "schemaVersion",
  "templates",
  "overrides",
  "occurrenceRecords",
  "finance",
  "deleted",
  "preferences",
] as const;

export const FINANCE_KEYS = [
  "incomeEvents",
  "monthlySalary",
  "monthlySavingsTargets",
  "monthlySavingsContributions",
  "monthClosures",
] as const;

export const DELETED_KEYS = [
  "categories",
  "templates",
  "overrides",
  "incomeEvents",
  "occurrenceRecords",
  "savingsContributions",
  "monthlySalary",
] as const;

export const PREFERENCE_KEYS = ["theme", "language"] as const;

// Datos de versiones antiguas que la normalización v3 descarta a propósito.
const RETIRED_KEYS = [
  "bankMovements",
  "bankMerchantAliases",
  "accounts",
  "allocation",
  "incomeSources",
  "purposes",
] as const;

// Primera versión cuyas claves desconocidas se conservan: las escribe un build
// más nuevo y un build anterior no debe borrarlas al guardar o sincronizar.
const PASSTHROUGH_SCHEMA_VERSION = 3;

type LegacyBankMovement = {
  id: string;
  userId: string;
  fingerprint: string;
  bookedAt: string;
  description: string;
  amount: number;
  matchedTemplateId?: string;
  matchedOccurrenceDate?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordOrEmpty<T>(value: unknown): Record<string, T> {
  return isRecord(value) ? (value as Record<string, T>) : {};
}

export function unknownEntries(
  value: unknown,
  knownKeys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) =>
        !knownKeys.includes(key) &&
        !(RETIRED_KEYS as readonly string[]).includes(key),
    ),
  );
}

function normalizeFinanceStore(
  value: unknown,
  needsLegacySavingsMigration: boolean,
  today: Date,
  keepUnknownKeys: boolean,
): FinanceStore {
  const finance = isRecord(value) ? value : {};

  const monthlySavingsTargets = normalizeSavingsTargets(
    finance.monthlySavingsTargets,
  );
  const monthlySavingsContributions = normalizeSavingsContributions(
    finance.monthlySavingsContributions,
  );

  if (needsLegacySavingsMigration) {
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
    ...(keepUnknownKeys ? unknownEntries(finance, FINANCE_KEYS) : {}),
    incomeEvents: Array.isArray(finance.incomeEvents)
      ? (finance.incomeEvents as FinanceStore["incomeEvents"])
      : [],
    monthlySalary: normalizeMonthlySalary(finance.monthlySalary),
    monthlySavingsTargets,
    monthlySavingsContributions,
    ...withMonthClosures(normalizeMonthClosures(finance.monthClosures)),
  };
}

function normalizeMonthClosures(value: unknown): Record<string, MonthClosure> {
  return Object.fromEntries(
    Object.entries(recordOrEmpty<unknown>(value)).flatMap(([monthId, entry]) => {
      if (
        !/^\d{4}-\d{2}$/.test(monthId) ||
        !isRecord(entry) ||
        !isTimestamp(entry.closedAt)
      ) {
        return [];
      }
      const closure: MonthClosure = {
        closedAt: entry.closedAt,
        updatedAt: isTimestamp(entry.updatedAt) ? entry.updatedAt : entry.closedAt,
      };
      if (isTimestamp(entry.reopenedAt)) closure.reopenedAt = entry.reopenedAt;
      return [[monthId, closure]];
    }),
  );
}

// Solo se escribe cuando hay algún cierre, para no añadir la clave a todos los
// stores.
export function withMonthClosures(closures: Record<string, MonthClosure>) {
  return Object.keys(closures).length > 0 ? { monthClosures: closures } : {};
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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

function normalizeDeletedIds(
  value: unknown,
  keepUnknownKeys: boolean,
): NonNullable<ExpenseStore["deleted"]> {
  const deleted = isRecord(value) ? value : {};

  return {
    ...(keepUnknownKeys ? unknownEntries(deleted, DELETED_KEYS) : {}),
    categories: stringArray(deleted.categories),
    templates: stringArray(deleted.templates),
    overrides: stringArray(deleted.overrides),
    incomeEvents: stringArray(deleted.incomeEvents),
    occurrenceRecords: stringArray(deleted.occurrenceRecords),
    savingsContributions: stringArray(deleted.savingsContributions),
    monthlySalary: stringArray(deleted.monthlySalary),
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
  const schemaVersion = Number(store.schemaVersion ?? 1);
  const needsLegacySavingsMigration = schemaVersion < 2;
  const needsBankMigration = schemaVersion < 3;
  const keepUnknownKeys = schemaVersion >= PASSTHROUGH_SCHEMA_VERSION;
  const legacyBankMovements =
    needsBankMigration && Array.isArray(store.bankMovements)
      ? (store.bankMovements as LegacyBankMovement[])
      : [];

  const deleted = normalizeDeletedIds(store.deleted, keepUnknownKeys);
  const base: ExpenseStore = {
    ...(keepUnknownKeys ? unknownEntries(store, STORE_KEYS) : {}),
    schemaVersion: 3,
    categories: Array.isArray(store.categories)
      ? normalizeCategories(store.categories)
      : [],
    templates: Array.isArray(store.templates)
      ? normalizeTemplates(store.templates, today)
      : [],
    overrides: Array.isArray(store.overrides)
      ? dedupeOverrides(
          store.overrides.filter(isRecord) as ExpenseStore["overrides"],
          deleted.overrides,
        )
      : [],
    occurrenceRecords: normalizeOccurrenceRecords(store.occurrenceRecords),
    finance: normalizeFinanceStore(
      store.finance,
      needsLegacySavingsMigration,
      today,
      keepUnknownKeys,
    ),
    deleted,
    preferences: {
      ...(keepUnknownKeys ? unknownEntries(preferences, PREFERENCE_KEYS) : {}),
      theme: normalizeAppTheme(preferences.theme),
      language: normalizeAppLanguage(preferences.language),
    },
  };
  const normalized = needsBankMigration
    ? normalizeImportedPaidOccurrenceDates(base, legacyBankMovements)
    : base;

  return materializeClosedOccurrenceRecords(normalized, {
    today,
    source: schemaVersion < 3 ? "legacy-derived" : "native",
  });
}

// Repara fechas y día de cobro imposibles (de la IA o de datos antiguos) para
// que un gasto corrupto no rompa el render ni el resto del store.
function normalizeTemplates(value: unknown[], today: Date): ExpenseTemplate[] {
  return value.filter(isRecord).map((raw) => {
    const template = raw as ExpenseTemplate;
    const startDate =
      normalizeDateOnly(template.startDate) ??
      normalizeDateOnly(String(template.createdAt ?? "").slice(0, 10)) ??
      toDateOnly(today);
    // Un fin ilegible se ajusta al inicio en lugar de quitar el límite: sin
    // él, un gasto ya terminado volvería a generar recibos.
    const endDate = template.endDate
      ? normalizeDateOnly(template.endDate) ?? startDate
      : undefined;
    const dueDay = Number.isInteger(Number(template.dueDay))
      ? Math.min(Math.max(Number(template.dueDay), 1), 31)
      : Number(startDate.slice(8, 10));
    // Notas, enlace de baja, permanencia y método de pago: lo ilegible se
    // descarta sin tocar el resto del gasto.
    const details = sanitizeExpenseDetails(template);
    const detailsChanged = EXPENSE_DETAIL_KEYS.some((key) => details[key] !== template[key]);

    if (
      startDate === template.startDate &&
      endDate === template.endDate &&
      dueDay === template.dueDay &&
      !detailsChanged
    ) {
      return template;
    }

    const next: ExpenseTemplate = { ...template, startDate, endDate, dueDay };
    for (const key of EXPENSE_DETAIL_KEYS) delete next[key];
    return { ...next, ...details };
  });
}

// Una categoría sin id no se puede referenciar: se descarta. Sin nombre pasa
// a General, y un color o icono desconocido vuelve al de su preset o al
// neutro.
function normalizeCategories(value: unknown[]): ExpenseCategory[] {
  return value.filter(isRecord).flatMap((raw) => {
    const category = raw as ExpenseCategory;
    if (typeof category.id !== "string" || !category.id) return [];

    const rawName = typeof category.name === "string" ? category.name.trim() : "";
    const name = (rawName || "General").slice(0, CATEGORY_NAME_MAX_LENGTH);
    const preset = findPresetCategory(name);
    const tone = isCategoryTone(category.tone) ? category.tone : preset?.tone ?? "slate";
    const icon =
      typeof category.icon === "string" && category.icon
        ? category.icon
        : preset?.icon ?? CUSTOM_CATEGORY_ICON;
    const userId = typeof category.userId === "string" ? category.userId : "demo";
    const updatedAt = isTimestamp(category.updatedAt) ? category.updatedAt : undefined;

    if (
      name === category.name &&
      tone === category.tone &&
      icon === category.icon &&
      userId === category.userId &&
      updatedAt === category.updatedAt
    ) {
      return [category];
    }

    const next: ExpenseCategory = { ...category, name, tone, icon, userId };
    if (updatedAt) next.updatedAt = updatedAt;
    else delete next.updatedAt;
    return [next];
  });
}

function normalizeOccurrenceRecords(
  value: unknown,
): ExpenseStore["occurrenceRecords"] {
  if (!Array.isArray(value)) return [];

  return (value as Array<NonNullable<ExpenseStore["occurrenceRecords"]>[number]>).map(
    (record) => ({
      ...record,
      source: record.source === "native" ? "native" : "legacy-derived",
    }),
  );
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
  };
}

function normalizeImportedPaidOccurrenceDates(
  store: ExpenseStore,
  legacyBankMovements: LegacyBankMovement[],
): ExpenseStore {
  const templatesById = new Map(store.templates.map((template) => [template.id, template]));
  const bankMovements = legacyBankMovements.map((movement) =>
    normalizeMatchedBankMovementOccurrenceDate(movement, templatesById),
  );
  const importedMovementDatesByTemplate = new Map<string, Set<string>>();

  for (const movement of bankMovements) {
    if (!movement.matchedTemplateId) continue;
    const dates = importedMovementDatesByTemplate.get(movement.matchedTemplateId) ?? new Set();
    dates.add(movement.bookedAt);
    importedMovementDatesByTemplate.set(movement.matchedTemplateId, dates);
  }

  const normalizedOverrides = store.overrides.map((override) =>
    normalizeImportedOverrideOccurrenceDate(
      override,
      templatesById,
      importedMovementDatesByTemplate,
    ),
  );
  const bankPaidOverrides = bankMovements.flatMap((movement) =>
    paidOverrideFromMatchedBankMovement(movement, templatesById),
  );

  return {
    ...store,
    overrides: mergeLegacyBankPaidOverrides(
      normalizedOverrides,
      bankPaidOverrides,
    ),
  };
}

function normalizeMatchedBankMovementOccurrenceDate(
  movement: LegacyBankMovement,
  templatesById: Map<string, ExpenseTemplate>,
): LegacyBankMovement {
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
  movement: LegacyBankMovement,
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

function mergeLegacyBankPaidOverrides(
  persistedOverrides: ExpenseOccurrenceOverride[],
  bankPaidOverrides: ExpenseOccurrenceOverride[],
) {
  const byKey = new Map<string, ExpenseOccurrenceOverride>();

  for (const override of persistedOverrides) {
    const key = `${override.templateId}:${override.occurrenceDate}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      (override.status === "paid" && existing.status !== "paid")
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

  for (const override of bankPaidOverrides) {
    const key = `${override.templateId}:${override.occurrenceDate}`;
    const existing = byKey.get(key);
    if (!existing || existing.status !== "paid") {
      byKey.set(key, override);
    }
  }

  return Array.from(byKey.values());
}
