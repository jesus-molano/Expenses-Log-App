import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  getYear,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { RRule } from "rrule";
import type {
  DraftExpense,
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
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
type TemplateSchedule = Pick<ExpenseTemplate, "startDate" | "endDate" | "dueDay" | "recurrence">;

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

export function generateTemplateDates(
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

// Un gasto nuevo cuyo primer cobro ya pasó este mes: hay que preguntar si ya
// se pagó. Sin fecha de inicio cuenta desde el día 1, como al guardarlo.
export function firstChargeAlreadyPassed(draft: DraftExpense, today: string) {
  const first = firstOccurrenceDate({
    ...draft,
    startDate: normalizeDateOnly(draft.startDate) ?? `${today.slice(0, 7)}-01`,
  });
  return first !== null && first.slice(0, 7) === today.slice(0, 7) && first < today;
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
          amount: override?.amount ?? template.amount,
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
