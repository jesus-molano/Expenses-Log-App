import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { toDateOnly } from "./calendar";
import { occurrencesDueBetween } from "./finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "./types";

export type MonthPendingSummary = {
  total: number;
  count: number;
  items: ExpenseOccurrence[];
  // Parte del total que vence este mes pero se cobra el siguiente (fin de semana).
  spillToNextMonthTotal: number;
};

// Regla única de "Por pagar" del mes: lo pendiente cuyo dueDate cae en el mes.
export function monthPendingSummary(
  occurrences: ExpenseOccurrence[],
  monthId: string,
): MonthPendingSummary {
  const items = occurrences.filter(
    (occurrence) =>
      occurrence.status === "due" && occurrence.dueDate.slice(0, 7) === monthId,
  );

  return {
    total: sumPlannedAmounts(items),
    count: items.length,
    items,
    spillToNextMonthTotal: sumPlannedAmounts(
      items.filter(
        (occurrence) => occurrence.estimatedChargeDate.slice(0, 7) > monthId,
      ),
    ),
  };
}

// Lo que quedó pendiente el mes anterior, para que no desaparezca el día 1.
export function selectCarryOverOccurrences(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  const previousMonth = subMonths(startOfMonth(today), 1);

  return occurrencesDueBetween(
    store,
    toDateOnly(previousMonth),
    toDateOnly(endOfMonth(previousMonth)),
    language,
  ).filter((occurrence) => occurrence.status === "due");
}

function sumPlannedAmounts(occurrences: ExpenseOccurrence[]) {
  return occurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
}
