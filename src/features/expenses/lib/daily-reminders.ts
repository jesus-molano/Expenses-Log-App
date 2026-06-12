import { subDays } from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseOccurrence, ExpenseStore } from "@/domain/types";

export type DailyReminder = {
  date: string;
  occurrences: ExpenseOccurrence[];
};

export function buildDailyReminder(
  store: ExpenseStore,
  today = new Date(),
): DailyReminder | null {
  const todayDate = toDateOnly(today);
  const windowStart = toDateOnly(subDays(today, 7));
  const occurrences = generateOccurrences(
    store.templates,
    store.overrides,
    windowStart,
    todayDate,
  ).filter(
    (occurrence) =>
      occurrence.status === "due" &&
      (occurrence.dueDate === todayDate ||
        occurrence.estimatedChargeDate === todayDate),
  );

  if (!occurrences.length) return null;

  return {
    date: todayDate,
    occurrences,
  };
}

export function dailyReminderBody(reminder: DailyReminder) {
  const count = reminder.occurrences.length;
  const [first, second] = reminder.occurrences;

  if (count === 1) {
    return `${first.template.name} vence hoy.`;
  }

  if (count === 2 && second) {
    return `${first.template.name} y ${second.template.name} vencen hoy.`;
  }

  return second
    ? `${first.template.name}, ${second.template.name} y ${count - 2} más vencen hoy.`
    : `Tienes ${count} gastos que vencen hoy.`;
}

export function dailyReminderTitle(reminder: DailyReminder) {
  return reminder.occurrences.length === 1
    ? "Tienes 1 gasto hoy"
    : `Tienes ${reminder.occurrences.length} gastos hoy`;
}

export function isExpenseStore(value: unknown): value is ExpenseStore {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<ExpenseStore>;

  return (
    Array.isArray(store.templates) &&
    Array.isArray(store.overrides) &&
    Array.isArray(store.categories) &&
    Boolean(store.finance)
  );
}
