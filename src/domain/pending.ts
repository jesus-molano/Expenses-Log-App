import type { ExpenseOccurrence } from "./types";

export type MonthPendingSummary = {
  total: number;
  count: number;
  items: ExpenseOccurrence[];
  // Parte del total que vence este mes pero se cobra el siguiente (fin de semana).
  spillToNextMonthTotal: number;
};

// Atrasado solo cuando ya pasó el día en que se espera el cargo: lo que vence
// en fin de semana no sale atrasado el lunes en que el banco lo cobra.
export function isOccurrenceOverdue(
  occurrence: Pick<ExpenseOccurrence, "status" | "estimatedChargeDate">,
  today: string,
) {
  return occurrence.status === "due" && occurrence.estimatedChargeDate < today;
}

// Regla única de "Por pagar" del mes: lo pendiente cuyo dueDate cae en el mes.
// La usan la cabecera de Gastos y el plan del mes. `range` son los días del
// mes de presupuesto cuando no es el natural (ciclo anclado al cobro).
export function monthPendingSummary(
  occurrences: ExpenseOccurrence[],
  monthId: string,
  range: { start: string; end: string } = calendarMonthRange(monthId),
): MonthPendingSummary {
  const items = occurrences.filter(
    (occurrence) =>
      occurrence.status === "due" &&
      occurrence.dueDate >= range.start &&
      occurrence.dueDate <= range.end,
  );

  return {
    total: sumPlannedAmounts(items),
    count: items.length,
    items,
    spillToNextMonthTotal: sumPlannedAmounts(
      items.filter((occurrence) => occurrence.estimatedChargeDate > range.end),
    ),
  };
}

// Cualquier fecha real del mes queda entre el 01 y el 31 al comparar textos.
function calendarMonthRange(monthId: string) {
  return { start: `${monthId}-01`, end: `${monthId}-31` };
}

function sumPlannedAmounts(occurrences: ExpenseOccurrence[]) {
  return occurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
}
