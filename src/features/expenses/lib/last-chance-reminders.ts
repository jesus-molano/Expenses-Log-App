import { addDays, subDays } from "date-fns";
import { daysBetween, toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseOccurrence, ExpenseStore } from "@/domain/types";

export type LastChanceReminder = {
  occurrence: ExpenseOccurrence;
  daysUntilCharge: number;
};

export function buildLastChanceReminders(
  store: ExpenseStore,
  today = new Date(),
): LastChanceReminder[] {
  const todayDate = toDateOnly(today);
  const from = toDateOnly(subDays(today, 7));
  const to = toDateOnly(addDays(today, 8));

  return generateOccurrences(
    store.templates,
    store.overrides,
    from,
    to,
    store.preferences?.language ?? "es",
  )
    .filter((occurrence) => occurrence.status === "due")
    .map((occurrence) => ({
      occurrence,
      daysUntilCharge: daysBetween(todayDate, occurrence.estimatedChargeDate),
    }))
    .filter(({ occurrence, daysUntilCharge }) => {
      const reminder = occurrence.template.reminder;
      if (!reminder?.enabled) return false;
      if (daysUntilCharge < 0 || daysUntilCharge > reminder.daysBeforeCharge) {
        return false;
      }

      return (
        occurrence.override?.reminderDismissedChargeDate !==
        occurrence.estimatedChargeDate
      );
    })
    .sort((left, right) => left.daysUntilCharge - right.daysUntilCharge);
}

export function buildPushLastChanceReminders(
  store: ExpenseStore,
  today = new Date(),
): LastChanceReminder[] {
  return buildLastChanceReminders(store, today).filter(
    (reminder) => reminder.daysUntilCharge === 1,
  );
}
