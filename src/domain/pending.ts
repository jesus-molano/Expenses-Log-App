import type { ExpenseOccurrence } from "./types";

export type MonthPendingSummary = {
  total: number;
  count: number;
  items: ExpenseOccurrence[];
  // Parte del total que vence este mes pero se cobra el siguiente (fin de semana).
  spillToNextMonthTotal: number;
};

// Regla única de "Por pagar" del mes: lo pendiente cuyo dueDate cae en el mes.
// La usan la cabecera de Gastos y el plan del mes.
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

function sumPlannedAmounts(occurrences: ExpenseOccurrence[]) {
  return occurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
}
