import { addMonthId } from "@/domain/budget-month";
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

// Un recibo que se pagará el mes siguiente se mueve a su día 1: sale el
// primero de ese mes y cuenta en sus totales.
export function leftoverMoveDate(monthId: string) {
  return `${addMonthId(monthId, 1)}-01`;
}

export function leftoverResolution(
  occurrence: ExpenseOccurrence,
  monthId: string,
): LeftoverResolution {
  if (occurrence.status === "paid") return "paid";
  if (occurrence.status === "skipped") return "skipped";
  return occurrence.dueDate.slice(0, 7) === monthId ? "pending" : "moved";
}

// Los restos que había al abrir el cierre, con su estado de ahora: la lista no
// cambia de forma mientras se resuelven. Si el gasto se borra, desaparece.
export function buildLeftoverRows(
  snapshot: LeftoverSnapshot[],
  occurrences: ExpenseOccurrence[],
  monthId: string,
): LeftoverRow[] {
  const byId = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  return snapshot.flatMap((item) => {
    const occurrence = byId.get(item.id);
    return occurrence
      ? [{ snapshot: item, occurrence, resolution: leftoverResolution(occurrence, monthId) }]
      : [];
  });
}
