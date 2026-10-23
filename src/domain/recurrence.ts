import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  getYear,
  isAfter,
  isBefore,
  parseISO,
  subDays,
} from "date-fns";
import { RRule } from "rrule";
import type {
  DraftExpense,
  ExpenseAmountChange,
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpensePause,
  ExpenseTemplate,
  AppLanguage,
  RecurrenceRule,
} from "./types";
import {
  buildDateWithDay,
  estimateChargeDate,
  isValidDateOnly,
  normalizeDateOnly,
  toDateOnly,
} from "./calendar";

// Lo que decide en qué fechas cae un gasto.
type TemplateSchedule = Pick<
  ExpenseTemplate,
  "startDate" | "endDate" | "dueDay" | "recurrence" | "pauses"
>;
// Igual, para un borrador que aún puede no tener fecha de inicio. Si es una
// serie ya guardada, sus pausas también cuentan.
type DraftSchedule = Pick<DraftExpense, "startDate" | "endDate" | "dueDay" | "recurrence"> &
  Pick<ExpenseTemplate, "pauses">;

function nextDate(date: Date, rule: RecurrenceRule): Date {
  const interval = Math.max(rule.interval ?? 1, 1);

  if (rule.frequency === "monthly") return addMonths(date, interval);
  if (rule.frequency === "quarterly") return addMonths(date, interval * 3);
  if (rule.frequency === "yearly") return addYears(date, interval);

  if (rule.frequency === "custom") {
    if (rule.unit === "day") return addDays(date, interval);
    if (rule.unit === "week") return addWeeks(date, interval);
    if (rule.unit === "year") return addYears(date, interval);
    return addMonths(date, interval);
  }

  return addMonths(date, 1);
}

function dateForRule(date: Date, template: TemplateSchedule): Date {
  const { recurrence } = template;
  if (recurrence.frequency === "once") return date;
  if (recurrence.frequency === "custom" && ["day", "week"].includes(recurrence.unit ?? "")) {
    return date;
  }
  return buildDateWithDay(date, template.dueDay);
}

function rruleDates(template: TemplateSchedule, from: Date, to: Date): Date[] {
  if (!template.recurrence.rrule) return [];

  try {
    const rule = RRule.fromString(template.recurrence.rrule);
    return rule
      .between(from, to, true)
      .map((date) => buildDateWithDay(date, template.dueDay));
  } catch {
    // Una regla inválida no debe romper el resto de gastos.
    return [];
  }
}

function annualTemplateDates(
  template: TemplateSchedule,
  from: Date,
  to: Date,
): string[] {
  const dates: string[] = [];
  const start = parseISO(template.startDate);
  const annualMonth = Math.min(
    Math.max(template.recurrence.annualMonth ?? start.getMonth() + 1, 1),
    12,
  );

  for (let year = getYear(from) - 1; year <= getYear(to) + 1; year += 1) {
    const candidate = buildDateWithDay(new Date(year, annualMonth - 1, 1), template.dueDay);
    if (!isBefore(candidate, from) && !isAfter(candidate, to) && !isBefore(candidate, start)) {
      dates.push(toDateOnly(candidate));
    }
  }

  return dates;
}

// Fechas en las que cae un gasto dentro del rango. El fin (`endDate`) se
// incluye y los cobros que caen en una pausa no se generan.
export function generateTemplateDates(
  template: TemplateSchedule,
  fromDate: string,
  toDate: string,
): string[] {
  const dates = scheduledTemplateDates(template, fromDate, toDate);
  return template.pauses?.length
    ? dates.filter((date) => !isPausedOn(template.pauses, date))
    : dates;
}

function scheduledTemplateDates(
  template: TemplateSchedule,
  fromDate: string,
  toDate: string,
): string[] {
  // Un gasto con fechas imposibles (p. ej. de la IA) no genera ocurrencias en
  // lugar de lanzar al formatear una fecha inválida.
  if (
    !isValidDateOnly(template.startDate) ||
    (template.endDate && !isValidDateOnly(template.endDate)) ||
    !Number.isFinite(template.dueDay)
  ) {
    return [];
  }

  const from = parseISO(fromDate);
  const configuredTo = parseISO(toDate);
  const end = template.endDate ? parseISO(template.endDate) : configuredTo;
  const to = isBefore(end, configuredTo) ? end : configuredTo;
  const start = parseISO(template.startDate);

  if (isBefore(to, from) || isBefore(to, start)) return [];

  if (template.recurrence.frequency === "once") {
    return !isBefore(start, from) && !isAfter(start, to)
      ? [toDateOnly(start)]
      : [];
  }

  if (template.recurrence.frequency === "rrule") {
    return rruleDates(template, from, to).map(toDateOnly);
  }

  if (template.recurrence.frequency === "yearly") {
    return annualTemplateDates(template, from, to);
  }

  const dates: string[] = [];
  let cursor = dateForRule(start, template);
  let guard = 0;

  while (isBefore(cursor, from) && guard < 500) {
    cursor = nextDate(cursor, template.recurrence);
    cursor = dateForRule(cursor, template);
    guard += 1;
  }

  while (!isAfter(cursor, to) && guard < 1000) {
    dates.push(toDateOnly(cursor));
    cursor = nextDate(cursor, template.recurrence);
    cursor = dateForRule(cursor, template);
    guard += 1;
  }

  return dates;
}

// Primer cobro de un gasto, con las mismas reglas que generan sus ocurrencias.
export function firstOccurrenceDate(template: TemplateSchedule): string | null {
  if (!isValidDateOnly(template.startDate)) return null;
  const horizon = toDateOnly(addYears(parseISO(template.startDate), 2));
  return generateTemplateDates(template, template.startDate, horizon)[0] ?? null;
}

// El cobro de este mes que ya pasó (antes de hoy) de un gasto nuevo, si lo
// hay. Sin fecha de inicio cuenta desde el día 1, como al guardarlo.
export function passedChargeThisMonth(draft: DraftSchedule, today: string): string | null {
  const monthStart = `${today.slice(0, 7)}-01`;
  if (today <= monthStart) return null;
  const startDate = normalizeDateOnly(draft.startDate) ?? monthStart;
  const yesterday = toDateOnly(subDays(parseISO(today), 1));
  return generateTemplateDates({ ...draft, startDate }, monthStart, yesterday)[0] ?? null;
}

// Un gasto nuevo cuyo cobro de este mes ya pasó: hay que preguntar si ya se
// pagó. Vale también para un gasto que empezó meses atrás.
export function firstChargeAlreadyPassed(draft: DraftSchedule, today: string) {
  return passedChargeThisMonth(draft, today) !== null;
}

// Cobros de un gasto nuevo anteriores al mes de hoy. Con una fecha de inicio
// pasada quedarían como impagados en cada mes ya cerrado (M18), así que se
// pregunta si se marcan pagados o saltados.
export function previousMonthsChargeDates(draft: DraftSchedule, today: string): string[] {
  const startDate = normalizeDateOnly(draft.startDate);
  const monthStart = `${today.slice(0, 7)}-01`;
  if (!startDate || startDate >= monthStart) return [];
  const previousMonthEnd = toDateOnly(subDays(parseISO(monthStart), 1));
  return generateTemplateDates({ ...draft, startDate }, startDate, previousMonthEnd);
}

// Si la fecha cae dentro de alguna pausa (ambos extremos incluidos; sin fin,
// la pausa sigue abierta).
export function isPausedOn(pauses: ExpensePause[] | undefined, date: string) {
  return (pauses ?? []).some(
    (pause) => pause.from <= date && (!pause.to || date <= pause.to),
  );
}

// La pausa que afecta hoy a la serie o, si no hay, la próxima programada.
export function currentOrNextPause(
  pauses: ExpensePause[] | undefined,
  today: string,
): { pause: ExpensePause; active: boolean } | null {
  const sorted = [...(pauses ?? [])].sort((a, b) => a.from.localeCompare(b.from));
  const active = sorted.find((pause) => isPausedOn([pause], today));
  if (active) return { pause: active, active: true };
  const next = sorted.find((pause) => pause.from > today);
  return next ? { pause: next, active: false } : null;
}

// Añade una pausa (una por fecha de inicio: otra con el mismo inicio la
// sustituye), ordenadas por inicio.
export function withPause(
  pauses: ExpensePause[] | undefined,
  pause: ExpensePause,
): ExpensePause[] {
  return [
    ...(pauses ?? []).filter((existing) => existing.from !== pause.from),
    pause.to ? { from: pause.from, to: pause.to } : { from: pause.from },
  ].sort((a, b) => a.from.localeCompare(b.from));
}

// Reanudar hoy: la pausa que cubre hoy termina ayer, para que el cobro de hoy
// y los siguientes vuelvan. Si empezaba hoy, desaparece. Las pausas futuras
// siguen programadas.
export function resumePausesOn(
  pauses: ExpensePause[] | undefined,
  today: string,
): ExpensePause[] {
  const yesterday = toDateOnly(addDays(parseISO(today), -1));
  return (pauses ?? []).flatMap((pause) => {
    if (!isPausedOn([pause], today)) return [pause];
    return pause.from > yesterday ? [] : [{ from: pause.from, to: yesterday }];
  });
}

// Importe de la serie para un cobro de esa fecha: el del último cambio de
// precio que ya ha empezado o, si no hay ninguno, el de la plantilla.
export function templateAmountOn(
  template: Pick<ExpenseTemplate, "amount" | "amountChanges">,
  date: string,
): number {
  let amount = template.amount;
  let effectiveFrom = "";
  for (const change of template.amountChanges ?? []) {
    if (change.from <= date && change.from >= effectiveFrom) {
      amount = change.amount;
      effectiveFrom = change.from;
    }
  }
  return amount;
}

// Programa un precio desde una fecha (uno por fecha: el nuevo sustituye al
// que hubiera ese día), ordenados por fecha.
export function withAmountChange(
  changes: ExpenseAmountChange[] | undefined,
  change: ExpenseAmountChange,
): ExpenseAmountChange[] {
  return [
    ...(changes ?? []).filter((existing) => existing.from !== change.from),
    { from: change.from, amount: change.amount },
  ].sort((a, b) => a.from.localeCompare(b.from));
}

// Cambios de precio legibles (de un store guardado, un archivo importado o el
// JSON que lee el cron), uno por fecha (gana el último) y en orden. Uno con
// fecha o importe imposible se descarta.
export function normalizeAmountChanges(value: unknown): ExpenseAmountChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const byDate = new Map<string, ExpenseAmountChange>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const from = normalizeDateOnly(entry.from);
    const amount = Number(entry.amount);
    if (!from || !Number.isFinite(amount) || amount <= 0) continue;
    byDate.set(from, { from, amount });
  }
  const changes = [...byDate.values()].sort((a, b) => a.from.localeCompare(b.from));
  return changes.length ? changes : undefined;
}

// Pausas legibles y en orden. Una con un fin ilegible o anterior al inicio se
// descarta: mejor volver a ver los cobros que esconderlos para siempre.
export function normalizePauses(value: unknown): ExpensePause[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const byStart = new Map<string, ExpensePause>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const from = normalizeDateOnly(entry.from);
    if (!from) continue;
    if (entry.to === undefined || entry.to === null) {
      byStart.set(from, { from });
      continue;
    }
    const to = normalizeDateOnly(entry.to);
    if (!to || to < from) continue;
    byStart.set(from, { from, to });
  }
  const pauses = [...byStart.values()].sort((a, b) => a.from.localeCompare(b.from));
  return pauses.length ? pauses : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function generateOccurrences(
  templates: ExpenseTemplate[],
  overrides: ExpenseOccurrenceOverride[],
  fromDate: string,
  toDate: string,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  const overrideByKey = new Map(
    overrides.map((override) => [
      `${override.templateId}:${override.occurrenceDate}`,
      override,
    ]),
  );

  return templates
    .filter((template) => template.active)
    .flatMap((template, templateIndex) =>
      generateTemplateDates(template, fromDate, toDate).map((date) => {
        const override = overrideByKey.get(`${template.id}:${date}`);
        const dueDate = override?.dueDate ?? date;
        const estimate = estimateChargeDate(dueDate, language);
        const defaultSortOrder = templateIndex * 1024;
        const effectiveTemplate = {
          ...template,
          name: override?.name ?? template.name,
          amount: override?.amount ?? templateAmountOn(template, date),
          categoryId: override?.categoryId ?? template.categoryId,
        };

        return {
          id: `${template.id}:${date}`,
          template: effectiveTemplate,
          occurrenceDate: date,
          dueDate,
          estimatedChargeDate: estimate.date,
          estimatedChargeLabel: estimate.label,
          status: override?.status ?? "due",
          sortOrder: override?.sortOrder ?? defaultSortOrder,
          override,
        } satisfies ExpenseOccurrence;
      }),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
