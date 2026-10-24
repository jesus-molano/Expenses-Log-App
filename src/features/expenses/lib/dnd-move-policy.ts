import { canMoveOccurrence } from "@/domain/budget-month";
import type { ExpenseOccurrence } from "@/domain/types";
import type { DropTarget } from "./expense-dnd-target";

// Vive en el dominio porque las órdenes de la captura siguen la misma regla.
export { canMoveOccurrence };

export type DragMoveAction = "ignore" | "single" | "series";

// Qué hacer al soltar un gasto en la timeline. `currentMonth` es el mes que se
// mira; `openMonth`, el mes natural (los anteriores están cerrados).
// - Nunca se suelta en un mes cerrado, aunque se esté mirando: sacaría el
//   cobro de los totales del mes en curso.
// - Lo pagado de un mes cerrado es historial y no se mueve. `canMove` es la
//   misma regla que siguen las acciones del cobro (con el ciclo del
//   presupuesto); sin ella, la del mes natural.
// - Lo pendiente de meses anteriores (o con registro histórico) solo mueve ese
//   cobro: cambiar la serie desde ahí reescribiría meses cerrados.
// - Cambiar el día de la serie deja cada cobro en su mes natural: soltado en
//   otro (con el ciclo anclado al cobro, un mes tiene días de dos), solo se
//   mueve ese cobro.
// Con el ciclo anclado al cobro los meses no empiezan el día 1: `floorDate`
// es el primer día en que se puede soltar (`cycleDropFloorDate`).
export function resolveDragMove({
  occurrence,
  target,
  currentMonth,
  openMonth = currentMonth,
  floorDate,
  canMove = (candidate) => canMoveOccurrence(candidate, openMonth),
}: {
  occurrence: ExpenseOccurrence;
  target: Pick<DropTarget, "date" | "rowId">;
  currentMonth: string;
  openMonth?: string;
  floorDate?: string;
  canMove?: (occurrence: ExpenseOccurrence) => boolean;
}): DragMoveAction {
  if (!isDropTargetAllowed(target, currentMonth, openMonth, floorDate)) {
    return "ignore";
  }
  if (target.date === occurrence.dueDate && !target.rowId) return "ignore";
  if (!canMove(occurrence)) return "ignore";
  const targetMonth = target.date.slice(0, 7);
  if (
    occurrence.record ||
    occurrence.dueDate.slice(0, 7) < currentMonth ||
    occurrence.dueDate.slice(0, 7) !== targetMonth ||
    occurrence.occurrenceDate.slice(0, 7) !== targetMonth
  ) {
    return "single";
  }
  return "series";
}

export function isDropTargetAllowed(
  target: (Partial<DropTarget> & Pick<DropTarget, "date">) | null,
  currentMonth: string,
  openMonth: string = currentMonth,
  floorDate?: string,
) {
  if (!target) return false;
  if (floorDate) return target.date >= floorDate;
  const floor = currentMonth > openMonth ? currentMonth : openMonth;
  return target.date.slice(0, 7) >= floor;
}
