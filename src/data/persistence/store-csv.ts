import { endOfMonth } from "date-fns";
import { normalizeDateOnly, toDateOnly } from "@/domain/calendar";
import { resolvePresetCategory } from "@/domain/categories";
import {
  earliestOccurrenceDate,
  generateStoreOccurrences,
  occurrenceRecordId,
  toMonthId,
} from "@/domain/finance";
import { overrideIdFor } from "@/domain/overrides";
import {
  normalizeAmountChanges,
  normalizePauses,
  templateAmountOn,
} from "@/domain/recurrence";
import { emptyStore } from "@/domain/seed";
import { foldText } from "@/domain/text";
import type {
  AppLanguage,
  ExpenseAmountChange,
  ExpenseCategory,
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseOccurrenceRecord,
  ExpensePause,
  ExpenseStore,
  ExpenseTemplate,
  OccurrenceStatus,
  RecurrenceRule,
} from "@/domain/types";
import { categoryLabel, resolveCategoryName } from "@/shared/category-labels";
import {
  CSV_BOM,
  parseCsv,
  protectSpreadsheetText,
  serializeCsv,
  unprotectSpreadsheetText,
} from "@/shared/csv";
import { parseMoneyInput } from "@/shared/money";
import { BackupFileError } from "./backup-errors";
import { normalizeExpenseStore } from "./store-normalization";

// Un solo CSV con dos tipos de fila: `expense` (la serie) y `occurrence` (un
// cobro concreto del histórico o con cambios). Las cabeceras y los valores de
// frecuencia y estado no se traducen para poder volver a importarlo; los
// nombres de categoría salen como se ven en la app y se reconocen en los dos
// idiomas al importar.
export const CSV_COLUMNS = [
  "type",
  "expense_id",
  "name",
  "category",
  "amount",
  "currency",
  "frequency",
  "interval",
  "unit",
  "annual_month",
  "rrule",
  "start_date",
  "end_date",
  "pauses",
  "price_changes",
  "due_day",
  "active",
  "reminder_days",
  "description",
  "occurrence_date",
  "due_date",
  "status",
  "paid_at",
  "amount_paid",
  "updated_at",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRow = Partial<Record<CsvColumn, string>>;

const FREQUENCIES = ["once", "monthly", "quarterly", "yearly"] as const;
const UNITS = ["day", "week", "month", "year"] as const;
const STATUSES: OccurrenceStatus[] = ["due", "paid", "skipped"];
const MAX_REMINDER_DAYS = 30;

export function storeToCsv(
  store: ExpenseStore,
  { today = new Date(), language = "es" }: { today?: Date; language?: AppLanguage } = {},
): string {
  const categoryNames = new Map(
    store.categories.map((category) => [category.id, category.name]),
  );
  const labelFor = (categoryId: string, fallback = "General") =>
    categoryLabel(categoryNames.get(categoryId) ?? fallback, language);

  const expenseRows = store.templates.map((template) =>
    toCells({
      type: "expense",
      expense_id: template.id,
      name: protectSpreadsheetText(template.name),
      category: labelFor(template.categoryId),
      amount: formatAmount(template.amount),
      currency: template.currency,
      ...recurrenceCells(template.recurrence),
      start_date: template.startDate,
      end_date: template.endDate ?? "",
      pauses: pausesCell(template.pauses),
      price_changes: priceChangesCell(template.amountChanges),
      due_day: String(template.dueDay),
      active: template.active ? "true" : "false",
      reminder_days: template.reminder?.enabled
        ? String(template.reminder.daysBeforeCharge)
        : "",
      description: protectSpreadsheetText(template.description),
      updated_at: template.updatedAt,
    }),
  );
  const occurrenceRows = historyOccurrences(store, today, language).map((occurrence) =>
    toCells({
      type: "occurrence",
      expense_id: occurrence.template.id,
      name: protectSpreadsheetText(occurrence.template.name),
      category: labelFor(occurrence.template.categoryId, occurrence.record?.categoryName),
      amount: formatAmount(occurrence.template.amount),
      currency: occurrence.template.currency,
      occurrence_date: occurrence.occurrenceDate,
      due_date: occurrence.dueDate,
      status: occurrence.status,
      paid_at: occurrence.override?.paidAt ?? occurrence.record?.paidAt ?? "",
      amount_paid: formatOptionalAmount(
        occurrence.override?.amountPaid ?? occurrence.record?.amountPaid,
      ),
      updated_at: occurrence.override?.updatedAt ?? occurrence.record?.updatedAt ?? "",
    }),
  );

  return CSV_BOM + serializeCsv([[...CSV_COLUMNS], ...expenseRows, ...occurrenceRows]);
}

// Todo lo que ya ha pasado hasta el final de este mes (el histórico de los
// meses cerrados incluido, también de gastos borrados) y, de más adelante, solo
// lo que tiene cambios, como un pago por adelantado.
function historyOccurrences(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage,
): ExpenseOccurrence[] {
  const first = earliestOccurrenceDate(store);
  if (!first || !normalizeDateOnly(first)) return [];
  const monthEnd = toDateOnly(endOfMonth(today));
  const last = store.overrides
    .flatMap((override) => [override.occurrenceDate, override.dueDate])
    .filter((date): date is string => normalizeDateOnly(date) === date)
    .reduce((latest, date) => (date > latest ? date : latest), monthEnd);

  return generateStoreOccurrences(store, first, last, language).filter(
    (occurrence) =>
      occurrence.occurrenceDate <= monthEnd ||
      Boolean(occurrence.override) ||
      Boolean(occurrence.record),
  );
}

function recurrenceCells(rule: RecurrenceRule): CsvRow {
  return {
    frequency: rule.frequency,
    interval: rule.frequency === "custom" ? String(rule.interval ?? 1) : "",
    unit: rule.frequency === "custom" ? (rule.unit ?? "month") : "",
    annual_month: rule.frequency === "yearly" && rule.annualMonth ? String(rule.annualMonth) : "",
    rrule: rule.frequency === "rrule" ? (rule.rrule ?? "") : "",
  };
}

// Pausas y cambios de precio de la serie, una celda cada uno: entradas
// separadas por espacios, "inicio/fin" (sin fin, la pausa sigue abierta) y
// "fecha=importe".
function pausesCell(pauses: ExpensePause[] | undefined) {
  return (pauses ?? []).map((pause) => `${pause.from}/${pause.to ?? ""}`).join(" ");
}

function priceChangesCell(changes: ExpenseAmountChange[] | undefined) {
  return (changes ?? [])
    .map((change) => `${change.from}=${formatAmount(change.amount)}`)
    .join(" ");
}

function cellEntries(value: string | undefined) {
  return (value ?? "").split(/[\s;]+/).filter(Boolean);
}

// Las entradas ilegibles se descartan con las mismas reglas que al cargar el
// store (una pausa con un fin ilegible no se convierte en una sin fin).
function pausesFromCell(value: string | undefined) {
  return normalizePauses(
    cellEntries(value).map((entry) => {
      const [from, to = ""] = entry.split("/");
      return { from, to: to || undefined };
    }),
  );
}

// El importe admite coma decimal, como el resto de importes del CSV.
function priceChangesFromCell(value: string | undefined) {
  return normalizeAmountChanges(
    cellEntries(value).map((entry) => {
      const [from, amount = ""] = entry.split("=");
      return { from, amount: parseMoneyInput(amount) };
    }),
  );
}

function toCells(row: CsvRow): string[] {
  return CSV_COLUMNS.map((column) => row[column] ?? "");
}

// Siempre con punto y dos decimales ("2200.00"): sin ambigüedad con los miles.
function formatAmount(amount: number) {
  return amount.toFixed(2);
}

function formatOptionalAmount(amount: number | undefined) {
  return amount === undefined ? "" : formatAmount(amount);
}

export type CsvImportResult = {
  store: ExpenseStore;
  skippedRows: number;
};

// Construye la parte de gastos de un store a partir de un CSV como el que
// exporta `storeToCsv`, o uno hecho a mano con al menos `name` y `amount`
// (sin columna `type`, cada fila es un gasto). Los meses cerrados vuelven
// como histórico; los abiertos, como cambios sobre su gasto. Las filas que no
// se pueden leer se cuentan y se saltan.
export function csvToStore(
  text: string,
  { now = new Date(), current }: { now?: Date; current?: ExpenseStore } = {},
): CsvImportResult {
  if (!text.trim()) throw new BackupFileError("empty");
  const [header, ...body] = parseCsv(text);
  if (!header) throw new BackupFileError("empty");
  const columns = header.map(normalizeHeader);
  if (!columns.includes("name") || !columns.includes("amount")) {
    throw new BackupFileError("csv-columns");
  }

  const rows = body.map(
    (cells) =>
      Object.fromEntries(
        columns.map((column, index) => [column, (cells[index] ?? "").trim()]),
      ) as CsvRow,
  );
  const typeOf = (row: CsvRow) =>
    columns.includes("type") ? foldText(row.type ?? "") : "expense";
  const context: RowContext = {
    nowIso: now.toISOString(),
    today: toDateOnly(now),
    currentMonthId: toMonthId(now),
    categories: createCategoryRegistry(current?.categories ?? []),
  };
  let skippedRows = 0;

  const templates = new Map<string, ExpenseTemplate>();
  for (const row of rows) {
    if (typeOf(row) !== "expense") continue;
    const template = templateFromRow(row, context);
    if (template) templates.set(template.id, template);
    else skippedRows += 1;
  }

  const knownTemplates = new Map(
    [...(current?.templates ?? []), ...templates.values()].map((template) => [
      template.id,
      template,
    ]),
  );
  const overrides: ExpenseOccurrenceOverride[] = [];
  const records: ExpenseOccurrenceRecord[] = [];
  for (const row of rows) {
    const type = typeOf(row);
    if (type === "expense") continue;
    const parsed = type === "occurrence" ? occurrenceFromRow(row, context, knownTemplates) : null;
    if (parsed === null) skippedRows += 1;
    else if (parsed.kind === "record") records.push(parsed.record);
    else if (parsed.kind === "override") overrides.push(parsed.override);
  }

  if (templates.size === 0 && overrides.length === 0 && records.length === 0) {
    throw new BackupFileError("csv-no-rows");
  }

  const store = normalizeExpenseStore(
    {
      ...emptyStore,
      categories: context.categories.used(),
      templates: Array.from(templates.values()),
      overrides,
      occurrenceRecords: records,
      preferences: current?.preferences ?? emptyStore.preferences,
    },
    now,
  );
  return { store, skippedRows };
}

type RowContext = {
  nowIso: string;
  today: string;
  currentMonthId: string;
  categories: CategoryRegistry;
};

function normalizeHeader(value: string) {
  return foldText(value).replace(/[\s-]+/g, "_");
}

function templateFromRow(row: CsvRow, context: RowContext): ExpenseTemplate | null {
  const name = readText(row.name);
  const amount = parseMoneyInput(row.amount ?? "");
  if (!name || amount === null || amount <= 0) return null;

  const startDate = normalizeDateOnly(row.start_date) ?? context.today;
  const endDate = normalizeDateOnly(row.end_date);
  const updatedAt = readTimestamp(row.updated_at) ?? context.nowIso;
  const reminderDays = readInteger(row.reminder_days, 0, MAX_REMINDER_DAYS);
  const pauses = pausesFromCell(row.pauses);
  const amountChanges = priceChangesFromCell(row.price_changes);

  return {
    id: row.expense_id || `exp-${crypto.randomUUID()}`,
    userId: "demo",
    name,
    description: readText(row.description),
    amount,
    currency: "EUR",
    categoryId: context.categories.idFor(resolveCategoryName(readText(row.category))),
    startDate,
    ...(endDate && endDate >= startDate ? { endDate } : {}),
    dueDay: readInteger(row.due_day, 1, 31) ?? Number(startDate.slice(8, 10)),
    recurrence: recurrenceFromRow(row, startDate),
    ...(reminderDays !== null
      ? { reminder: { enabled: true, daysBeforeCharge: reminderDays } }
      : {}),
    ...(amountChanges ? { amountChanges } : {}),
    ...(pauses ? { pauses } : {}),
    active: !/^(false|0|no|n)$/i.test(row.active ?? ""),
    createdAt: updatedAt,
    updatedAt,
  };
}

function recurrenceFromRow(row: CsvRow, startDate: string): RecurrenceRule {
  const frequency = foldText(row.frequency ?? "");
  if (frequency === "custom") {
    const unit = foldText(row.unit ?? "");
    return {
      frequency,
      interval: readInteger(row.interval, 1, 999) ?? 1,
      unit: (UNITS as readonly string[]).includes(unit)
        ? (unit as (typeof UNITS)[number])
        : "month",
    };
  }
  if (frequency === "yearly") {
    return {
      frequency,
      annualMonth: readInteger(row.annual_month, 1, 12) ?? Number(startDate.slice(5, 7)),
    };
  }
  if (frequency === "rrule" && row.rrule) return { frequency, rrule: row.rrule };
  if ((FREQUENCIES as readonly string[]).includes(frequency)) {
    return { frequency: frequency as (typeof FREQUENCIES)[number] };
  }
  return { frequency: "monthly" };
}

type ParsedOccurrence =
  | { kind: "record"; record: ExpenseOccurrenceRecord }
  | { kind: "override"; override: ExpenseOccurrenceOverride }
  | { kind: "unchanged" };

function occurrenceFromRow(
  row: CsvRow,
  context: RowContext,
  templates: Map<string, ExpenseTemplate>,
): ParsedOccurrence | null {
  const templateId = row.expense_id ?? "";
  const occurrenceDate = normalizeDateOnly(row.occurrence_date);
  if (!templateId || !occurrenceDate) return null;

  const rawStatus = foldText(row.status ?? "");
  const status = STATUSES.find((candidate) => candidate === rawStatus) ?? "due";
  const dueDate = normalizeDateOnly(row.due_date) ?? occurrenceDate;
  const updatedAt = readTimestamp(row.updated_at) ?? context.nowIso;
  const paidAt = status === "paid" ? readTimestamp(row.paid_at) : undefined;
  const amountPaid =
    status === "paid" ? parseMoneyInput(row.amount_paid ?? "") ?? undefined : undefined;
  const plannedAmount = parseMoneyInput(row.amount ?? "");
  const name = readText(row.name);
  const categoryName = row.category ? resolveCategoryName(readText(row.category)) : null;

  // Un mes ya cerrado se guarda como histórico, igual que lo hace la app al
  // cerrarlo: así se conserva aunque el gasto ya no exista o haya cambiado.
  const closed =
    occurrenceDate.slice(0, 7) < context.currentMonthId &&
    dueDate.slice(0, 7) < context.currentMonthId;
  if (closed) {
    const template = templates.get(templateId);
    const recordName = name || template?.name;
    const recordAmount =
      plannedAmount ?? (template ? templateAmountOn(template, occurrenceDate) : amountPaid);
    if (!recordName || !recordAmount || recordAmount <= 0) return null;
    const recordCategory =
      categoryName ?? context.categories.nameOf(template?.categoryId) ?? "General";
    return {
      kind: "record",
      record: {
        id: occurrenceRecordId(templateId, occurrenceDate),
        userId: "demo",
        templateId,
        occurrenceDate,
        monthId: dueDate.slice(0, 7),
        dueDate,
        name: recordName,
        description: template?.description ?? "",
        plannedAmount: recordAmount,
        currency: "EUR",
        categoryId: context.categories.idFor(recordCategory),
        categoryName: recordCategory,
        status,
        sortOrder: 0,
        ...(paidAt ? { paidAt } : {}),
        ...(amountPaid !== undefined ? { amountPaid } : {}),
        source: "native",
        createdAt: updatedAt,
        updatedAt,
      },
    };
  }

  const template = templates.get(templateId);
  if (!template) return null;
  const categoryId = categoryName ? context.categories.idFor(categoryName) : null;
  const patch: Partial<ExpenseOccurrenceOverride> = {
    ...(dueDate !== occurrenceDate ? { dueDate } : {}),
    // Lo previsto de ese cobro ya cuenta los cambios de precio de la serie.
    ...(plannedAmount !== null &&
    plannedAmount > 0 &&
    plannedAmount !== templateAmountOn(template, occurrenceDate)
      ? { amount: plannedAmount }
      : {}),
    ...(name && name !== template.name ? { name } : {}),
    ...(categoryId && categoryId !== template.categoryId ? { categoryId } : {}),
    ...(paidAt ? { paidAt } : {}),
    ...(amountPaid !== undefined ? { amountPaid } : {}),
  };
  // Un cobro pendiente sin cambios no necesita guardarse.
  if (status === "due" && Object.keys(patch).length === 0) return { kind: "unchanged" };

  return {
    kind: "override",
    override: {
      id: overrideIdFor({ templateId, occurrenceDate }),
      userId: "demo",
      templateId,
      occurrenceDate,
      status,
      ...patch,
      updatedAt,
      statusUpdatedAt: updatedAt,
    },
  };
}

type CategoryRegistry = ReturnType<typeof createCategoryRegistry>;

// Reutiliza la categoría que ya existe con ese nombre (sin tildes) para no
// duplicarla al combinar; si no, crea la del preset.
function createCategoryRegistry(existing: ExpenseCategory[]) {
  const byName = new Map(existing.map((category) => [foldText(category.name), category]));
  const byId = new Map(existing.map((category) => [category.id, category]));
  const used = new Map<string, ExpenseCategory>();

  return {
    nameOf(id: string | undefined) {
      return id ? (byId.get(id) ?? used.get(id))?.name : undefined;
    },
    idFor(name: string) {
      const key = foldText(name);
      let category = byName.get(key);
      if (!category) {
        const preset = resolvePresetCategory(name);
        category = {
          id: `cat-${crypto.randomUUID()}`,
          userId: "demo",
          name: preset.name,
          icon: preset.icon,
          tone: preset.tone,
        };
        byName.set(key, category);
      }
      used.set(category.id, category);
      return category.id;
    },
    used: () => Array.from(used.values()),
  };
}

function readText(value: string | undefined) {
  return unprotectSpreadsheetText(value ?? "").trim();
}

function readInteger(value: string | undefined, min: number, max: number) {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function readTimestamp(value: string | undefined) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}
