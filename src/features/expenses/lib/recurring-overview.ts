import {
  addYears,
  endOfYear,
  parseISO,
  startOfYear,
  subYears,
} from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type {
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseTemplate,
} from "@/domain/types";

export type RecurringOverviewStatus =
  | "overdue"
  | "current"
  | "upcoming"
  | "settled";

export type RecurringOverviewItem = {
  template: ExpenseTemplate;
  status: RecurringOverviewStatus;
  overdueOccurrence: ExpenseOccurrence | null;
  currentOccurrence: ExpenseOccurrence | null;
  nextOccurrence: ExpenseOccurrence | null;
  lastPaidOccurrence: ExpenseOccurrence | null;
  sortDate: string;
};

export function buildRecurringOverview({
  templates,
  overrides,
  windowStart,
  windowEnd,
}: {
  templates: ExpenseTemplate[];
  overrides: ExpenseOccurrenceOverride[];
  windowStart: string;
  windowEnd: string;
}): RecurringOverviewItem[] {
  const monthStart = parseISO(windowStart);
  const rangeStart = toDateOnly(startOfYear(subYears(monthStart, 1)));
  const rangeEnd = toDateOnly(endOfYear(addYears(monthStart, 1)));
  const recurringTemplates = templates.filter(
    (template) =>
      template.active &&
      ["quarterly", "yearly"].includes(template.recurrence.frequency) &&
      (!template.endDate || template.endDate >= windowStart),
  );
  const occurrences = generateOccurrences(
    recurringTemplates,
    overrides,
    rangeStart,
    rangeEnd,
  ).filter((occurrence) => occurrence.status !== "skipped");
  const occurrencesByTemplate = groupOccurrencesByTemplate(occurrences);

  return recurringTemplates
    .map((template) => {
      const templateOccurrences = occurrencesByTemplate.get(template.id) ?? [];
      const overdueOccurrence = latestOccurrence(
        templateOccurrences.filter(
          (occurrence) =>
            occurrence.dueDate < windowStart && occurrence.status !== "paid",
        ),
      );
      const currentOccurrence =
        templateOccurrences.find(
          (occurrence) =>
            occurrence.dueDate >= windowStart &&
            occurrence.dueDate <= windowEnd,
        ) ?? null;
      const nextOccurrence =
        templateOccurrences.find((occurrence) => occurrence.dueDate > windowEnd) ??
        null;
      const lastPaidOccurrence = latestOccurrence(
        templateOccurrences.filter(
          (occurrence) =>
            occurrence.status === "paid" && occurrence.dueDate <= windowEnd,
        ),
      );
      const status = resolveRecurringStatus({
        overdueOccurrence,
        currentOccurrence,
        nextOccurrence,
      });

      return {
        template,
        status,
        overdueOccurrence,
        currentOccurrence,
        nextOccurrence,
        lastPaidOccurrence,
        sortDate:
          overdueOccurrence?.dueDate ??
          currentOccurrence?.dueDate ??
          nextOccurrence?.dueDate ??
          lastPaidOccurrence?.dueDate ??
          template.startDate,
      } satisfies RecurringOverviewItem;
    })
    .filter(
      (item) =>
        item.overdueOccurrence ||
        item.currentOccurrence ||
        item.nextOccurrence ||
        item.lastPaidOccurrence,
    )
    .sort(sortRecurringOverviewItems);
}

function groupOccurrencesByTemplate(occurrences: ExpenseOccurrence[]) {
  const groups = new Map<string, ExpenseOccurrence[]>();

  for (const occurrence of occurrences) {
    const group = groups.get(occurrence.template.id) ?? [];
    group.push(occurrence);
    groups.set(occurrence.template.id, group);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  return groups;
}

function latestOccurrence(
  occurrences: ExpenseOccurrence[],
): ExpenseOccurrence | null {
  return occurrences
    .slice()
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0] ?? null;
}

function resolveRecurringStatus({
  overdueOccurrence,
  currentOccurrence,
  nextOccurrence,
}: Pick<
  RecurringOverviewItem,
  "overdueOccurrence" | "currentOccurrence" | "nextOccurrence"
>): RecurringOverviewStatus {
  if (overdueOccurrence) return "overdue";
  if (currentOccurrence && currentOccurrence.status !== "paid") return "current";
  if (nextOccurrence) return "upcoming";
  return "settled";
}

function sortRecurringOverviewItems(
  a: RecurringOverviewItem,
  b: RecurringOverviewItem,
): number {
  const priority = {
    overdue: 0,
    current: 1,
    upcoming: 2,
    settled: 3,
  } satisfies Record<RecurringOverviewStatus, number>;

  if (priority[a.status] !== priority[b.status]) {
    return priority[a.status] - priority[b.status];
  }

  if (a.sortDate !== b.sortDate) return a.sortDate.localeCompare(b.sortDate);
  return a.template.name.localeCompare(b.template.name);
}
