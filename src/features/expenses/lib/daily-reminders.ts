import { isValidDateOnly, toDateOnly } from "@/domain/calendar";
import type {
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  OccurrenceStatus,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/domain/types";
import { normalizeAppLanguage } from "@/shared/i18n";
import { DEFAULT_THEME } from "@/shared/theme";
import { buildPushDueReminders } from "./last-chance-reminders";

export type DailyReminder = {
  date: string;
  occurrences: ExpenseOccurrence[];
};

export function buildDailyReminder(
  store: ExpenseStore,
  today = new Date(),
): DailyReminder | null {
  const occurrences = buildPushDueReminders(store, today).map(
    (reminder) => reminder.occurrence,
  );

  if (!occurrences.length) return null;

  return {
    date: toDateOnly(today),
    occurrences,
  };
}

export function dailyReminderBody(reminder: DailyReminder) {
  const count = reminder.occurrences.length;
  const [first, second] = reminder.occurrences;

  if (count === 1) {
    return `${first.template.name} se cobrará pronto.`;
  }

  if (count === 2 && second) {
    return `${first.template.name} y ${second.template.name} se cobrarán pronto.`;
  }

  return second
    ? `${first.template.name}, ${second.template.name} y ${count - 2} más se cobrarán pronto.`
    : `Tienes ${count} gastos por revisar.`;
}

export function dailyReminderTitle(reminder: DailyReminder) {
  return reminder.occurrences.length === 1
    ? "Revisa este cobro"
    : `${reminder.occurrences.length} cobros por revisar`;
}

const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = [
  "once",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
  "rrule",
];
const OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = ["due", "paid", "skipped"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptional(value: unknown, check: (value: unknown) => boolean) {
  return value === undefined || value === null || check(value);
}

const isString = (value: unknown) => typeof value === "string";
const isFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  return (
    isRecord(value) &&
    RECURRENCE_FREQUENCIES.includes(value.frequency as RecurrenceFrequency) &&
    isOptional(value.interval, isFiniteNumber) &&
    isOptional(value.unit, isString) &&
    isOptional(value.rrule, isString) &&
    isOptional(value.annualMonth, isFiniteNumber)
  );
}

// Solo cuentan los gastos activos con aviso y con todo lo que el aviso usa
// bien formado.
function isRemindableTemplate(value: unknown): value is ExpenseTemplate {
  if (!isRecord(value)) return false;
  const reminder = value.reminder;

  return (
    isString(value.id) &&
    isString(value.name) &&
    value.active === true &&
    isValidDateOnly(value.startDate) &&
    isOptional(value.endDate, isValidDateOnly) &&
    isFiniteNumber(value.dueDay) &&
    isRecurrenceRule(value.recurrence) &&
    isRecord(reminder) &&
    reminder.enabled === true &&
    isFiniteNumber(reminder.daysBeforeCharge)
  );
}

function toReminderOverride(value: unknown): ExpenseOccurrenceOverride[] {
  if (
    !isRecord(value) ||
    !isString(value.templateId) ||
    !isValidDateOnly(value.occurrenceDate) ||
    !OCCURRENCE_STATUSES.includes(value.status as OccurrenceStatus)
  ) {
    return [];
  }

  const override = { ...value } as ExpenseOccurrenceOverride;
  // Sin una fecha movida legible se usa la original: descartar el override
  // entero volvería a avisar de un recibo ya pagado.
  if (!isOptional(value.dueDate, isValidDateOnly)) delete override.dueDate;
  if (!isOptional(value.name, isString)) delete override.name;
  return [override];
}

// El cron lee el jsonb tal y como lo subió cada cliente: puede venir de un
// build antiguo o estar corrupto. Se queda solo con lo que el aviso necesita y
// con la forma esperada, en lugar de dejar que una pieza rota lance al
// generar las ocurrencias. Devuelve null si no parece un store.
export function toReminderStore(value: unknown): ExpenseStore | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.templates) ||
    !Array.isArray(value.overrides)
  ) {
    return null;
  }

  const preferences = isRecord(value.preferences) ? value.preferences : {};

  return {
    categories: [],
    templates: value.templates.filter(isRemindableTemplate),
    overrides: value.overrides.flatMap(toReminderOverride),
    finance: {
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets: {},
    },
    preferences: {
      theme: DEFAULT_THEME,
      language: normalizeAppLanguage(preferences.language),
    },
  };
}
