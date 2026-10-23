import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import { isValidDateOnly } from "@/domain/calendar";
import type {
  ExpenseOccurrenceOverride,
  ExpenseOccurrenceRecord,
  ExpenseStore,
  ExpenseTemplate,
  OccurrenceStatus,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/domain/types";

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
const isOccurrenceStatus = (value: unknown) =>
  OCCURRENCE_STATUSES.includes(value as OccurrenceStatus);

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

// Gastos con todo lo que los avisos leen bien formado (el importe va en el
// texto). No se filtra por su aviso: el propio se lee con las reglas de la app
// (`sanitizeTemplateReminder`) y, si no tiene, el gasto sigue el aviso por
// defecto de Ajustes (`resolveTemplateReminder`): con los avisos activados
// por defecto también avisa. Los que no avisan cuentan igual para "mes al
// día", el día de cobro y el número del icono.
function isReminderTemplate(value: unknown): value is ExpenseTemplate {
  if (!isRecord(value)) return false;

  return (
    isString(value.id) &&
    isString(value.name) &&
    isFiniteNumber(value.amount) &&
    typeof value.active === "boolean" &&
    isValidDateOnly(value.startDate) &&
    isOptional(value.endDate, isValidDateOnly) &&
    isFiniteNumber(value.dueDay) &&
    isRecurrenceRule(value.recurrence)
  );
}

function toReminderOverride(value: unknown): ExpenseOccurrenceOverride[] {
  if (
    !isRecord(value) ||
    !isString(value.templateId) ||
    !isValidDateOnly(value.occurrenceDate) ||
    !isOccurrenceStatus(value.status)
  ) {
    return [];
  }

  const override = { ...value } as ExpenseOccurrenceOverride;
  // Sin una fecha movida legible se usa la original: descartar el override
  // entero volvería a avisar de un recibo ya pagado.
  if (!isOptional(value.dueDate, isValidDateOnly)) delete override.dueDate;
  if (!isOptional(value.name, isString)) delete override.name;
  if (!isOptional(value.amount, isFiniteNumber)) delete override.amount;
  return [override];
}

// Registros de meses pasados: los avisos de "¿se cobró?", el día de cobro y
// el número del icono miran también el mes anterior.
function isReminderRecord(value: unknown): value is ExpenseOccurrenceRecord {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.templateId) &&
    isString(value.name) &&
    isValidDateOnly(value.occurrenceDate) &&
    isValidDateOnly(value.dueDate) &&
    isFiniteNumber(value.plannedAmount) &&
    isOccurrenceStatus(value.status)
  );
}

// El cron lee el jsonb tal y como lo subió cada cliente: puede venir de un
// build antiguo o estar corrupto. Se queda con los gastos, overrides y
// registros con la forma que los avisos necesitan, en lugar de dejar que una
// pieza rota lance al generar las ocurrencias, y normaliza el resto como la
// app (ajustes de avisos, idioma, finanzas). Las pausas y los cambios de
// precio deciden qué cobros hay y cuánto cuestan: la normalización de la app
// los sanea (`normalizePauses`, `normalizeAmountChanges`) y descarta uno roto
// en lugar de lanzar, así que un gasto en pausa o finalizado no avisa y el
// importe del aviso es el del propio cobro. Devuelve null si no parece un
// store.
export function toReminderStore(
  value: unknown,
  today: Date = new Date(),
): ExpenseStore | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.templates) ||
    !Array.isArray(value.overrides)
  ) {
    return null;
  }

  return normalizeExpenseStore(
    {
      ...value,
      templates: value.templates.filter(isReminderTemplate),
      overrides: value.overrides.flatMap(toReminderOverride),
      occurrenceRecords: Array.isArray(value.occurrenceRecords)
        ? value.occurrenceRecords.filter(isReminderRecord)
        : [],
    },
    today,
  );
}
