import { toDateOnly } from "@/domain/calendar";
import type { ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { buildPushLastChanceReminders } from "./last-chance-reminders";

export type DailyReminder = {
  date: string;
  occurrences: ExpenseOccurrence[];
};

export function buildDailyReminder(
  store: ExpenseStore,
  today = new Date(),
): DailyReminder | null {
  const occurrences = buildPushLastChanceReminders(store, today).map(
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
