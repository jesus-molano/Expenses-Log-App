import { buildOccurrenceReminders } from "@/domain/reminder-schedule";
import type { ExpenseOccurrence, ExpenseStore } from "@/domain/types";

export type LastChanceReminder = {
  occurrence: ExpenseOccurrence;
  daysUntilCharge: number;
};

// Aviso dentro de la app: los cobros que aún no han llegado (hasta el mismo
// día del cargo) con aviso activo, propio o por defecto, y sin "Entendido".
export function buildLastChanceReminders(
  store: ExpenseStore,
  today = new Date(),
): LastChanceReminder[] {
  return buildOccurrenceReminders(store, today)
    .filter((reminder) => reminder.stage !== "charge_check")
    .map(({ occurrence, daysUntilCharge }) => ({ occurrence, daysUntilCharge }))
    .sort((left, right) => left.daysUntilCharge - right.daysUntilCharge);
}
