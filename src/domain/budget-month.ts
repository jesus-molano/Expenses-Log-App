import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { toDateOnly } from "./calendar";
import { occurrencesDueBetween } from "./finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "./types";

export { monthPendingSummary, type MonthPendingSummary } from "./pending";

// Lo que quedó pendiente el mes anterior, para que no desaparezca el día 1.
// Lo pagado hoy se mantiene visible para poder deshacerlo desde la misma fila.
// Los gastos borrados conservan su historial, pero no vuelven a reclamar pago.
export function selectCarryOverOccurrences(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  const previousMonth = subMonths(startOfMonth(today), 1);
  const todayId = toDateOnly(today);
  const templateIds = new Set(store.templates.map((template) => template.id));

  return occurrencesDueBetween(
    store,
    toDateOnly(previousMonth),
    toDateOnly(endOfMonth(previousMonth)),
    language,
  ).filter(
    (occurrence) =>
      templateIds.has(occurrence.template.id) &&
      (occurrence.status === "due" ||
        (occurrence.status === "paid" && paidOn(occurrence) === todayId)),
  );
}

function paidOn(occurrence: ExpenseOccurrence) {
  const paidAt = occurrence.override?.paidAt ?? occurrence.record?.paidAt;
  if (!paidAt) return null;
  const date = new Date(paidAt);
  return Number.isNaN(date.getTime()) ? null : toDateOnly(date);
}
