import {
  addMonthId,
  CALENDAR_CYCLE,
  periodIdOf,
  periodStart,
  type BudgetCycle,
} from "@/domain/budget-cycle";
import type { ExpenseOccurrence } from "@/domain/types";

// Un resto tal como estaba al abrir el cierre: su fecha sirve para deshacer
// un "Mover".
export type LeftoverSnapshot = { id: string; dueDate: string };

export type LeftoverResolution = "pending" | "paid" | "skipped" | "moved";

export type LeftoverRow = {
  snapshot: LeftoverSnapshot;
  occurrence: ExpenseOccurrence;
  resolution: LeftoverResolution;
};

export function snapshotLeftovers(leftovers: ExpenseOccurrence[]): LeftoverSnapshot[] {
  return leftovers.map((occurrence) => ({
    id: occurrence.id,
    dueDate: occurrence.dueDate,
  }));
}

// Un recibo que se pagará el mes siguiente se mueve a su primer día (el 1 o,
// con el ciclo anclado al cobro, el día de cobro): sale el primero de ese mes
// y cuenta en sus totales.
export function leftoverMoveDate(monthId: string, cycle: BudgetCycle = CALENDAR_CYCLE) {
  return periodStart(addMonthId(monthId, 1), cycle);
}

export function leftoverResolution(
  occurrence: ExpenseOccurrence,
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): LeftoverResolution {
  if (occurrence.status === "paid") return "paid";
  if (occurrence.status === "skipped") return "skipped";
  return periodIdOf(occurrence.dueDate, cycle) === monthId ? "pending" : "moved";
}

// Los restos que había al abrir el cierre, con su estado de ahora: la lista no
// cambia de forma mientras se resuelven. Si el gasto se borra, desaparece.
export function buildLeftoverRows(
  snapshot: LeftoverSnapshot[],
  occurrences: ExpenseOccurrence[],
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): LeftoverRow[] {
  const byId = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  return snapshot.flatMap((item) => {
    const occurrence = byId.get(item.id);
    return occurrence
      ? [
          {
            snapshot: item,
            occurrence,
            resolution: leftoverResolution(occurrence, monthId, cycle),
          },
        ]
      : [];
  });
}
