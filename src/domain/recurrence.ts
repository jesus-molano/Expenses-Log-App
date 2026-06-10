import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { RRule } from "rrule";
import type {
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseTemplate,
  RecurrenceRule,
} from "./types";
import { buildDateWithDay, estimateChargeDate, toDateOnly } from "./calendar";

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

function rruleDates(template: ExpenseTemplate, from: Date, to: Date): Date[] {
  if (!template.recurrence.rrule) return [];

  const rule = RRule.fromString(template.recurrence.rrule);
  return rule.between(from, to, true).map((date) =>
    buildDateWithDay(date, template.dueDay),
  );
}

export function generateTemplateDates(
  template: ExpenseTemplate,
  fromDate: string,
  toDate: string,
): string[] {
  const from = parseISO(fromDate);
  const to = parseISO(toDate);
  const start = parseISO(template.startDate);

  if (template.recurrence.frequency === "rrule") {
    return rruleDates(template, from, to).map(toDateOnly);
  }

  const dates: string[] = [];
  let cursor = buildDateWithDay(start, template.dueDay);
  let guard = 0;

  while (isBefore(cursor, from) && guard < 500) {
    cursor = nextDate(cursor, template.recurrence);
    cursor = buildDateWithDay(cursor, template.dueDay);
    guard += 1;
  }

  while (!isAfter(cursor, to) && guard < 1000) {
    dates.push(toDateOnly(cursor));
    cursor = nextDate(cursor, template.recurrence);
    cursor = buildDateWithDay(cursor, template.dueDay);
    guard += 1;
  }

  return dates;
}

export function generateOccurrences(
  templates: ExpenseTemplate[],
  overrides: ExpenseOccurrenceOverride[],
  fromDate: string,
  toDate: string,
): ExpenseOccurrence[] {
  const overrideByKey = new Map(
    overrides.map((override) => [
      `${override.templateId}:${override.occurrenceDate}`,
      override,
    ]),
  );

  return templates
    .filter((template) => template.active)
    .flatMap((template) =>
      generateTemplateDates(template, fromDate, toDate).map((date) => {
        const override = overrideByKey.get(`${template.id}:${date}`);
        const estimate = estimateChargeDate(date);

        return {
          id: `${template.id}:${date}`,
          template,
          occurrenceDate: date,
          dueDate: date,
          estimatedChargeDate: estimate.date,
          estimatedChargeLabel: estimate.label,
          status: override?.status ?? "due",
          override,
        } satisfies ExpenseOccurrence;
      }),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function recurrenceLabel(rule: RecurrenceRule): string {
  if (rule.frequency === "monthly") return "Mensual";
  if (rule.frequency === "quarterly") return "Trimestral";
  if (rule.frequency === "yearly") return "Anual";
  if (rule.frequency === "rrule") return "Avanzada";

  const interval = rule.interval ?? 1;
  const unit = rule.unit ?? "month";
  const units = {
    day: "dias",
    week: "semanas",
    month: "meses",
    year: "anos",
  };

  return `Cada ${interval} ${units[unit]}`;
}
