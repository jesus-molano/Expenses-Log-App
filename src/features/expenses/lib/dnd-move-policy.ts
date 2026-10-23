import type { ExpenseOccurrence } from "@/domain/types";
import type { DropTarget } from "./expense-dnd-target";

export type DragMoveAction = "ignore" | "single" | "series";

// Qué hacer al soltar un gasto en la timeline. `currentMonth` es el mes que se
// mira; `openMonth`, el mes natural (los anteriores están cerrados).
// - Nunca se suelta en un mes cerrado, aunque se esté mirando: sacaría el
//   cobro de los totales del mes en curso.
// - Lo pagado de un mes cerrado es historial y no se mueve.
// - Lo pendiente de meses anteriores (o con registro histórico) solo mueve ese
//   cobro: cambiar la serie desde ahí reescribiría meses cerrados.
// Lo pagado de un mes cerrado es historial y no se mueve (ni arrastrando ni
// desde las acciones del cobro).
export function canMoveOccurrence(occurrence: ExpenseOccurrence, openMonth: string) {
  return !(occurrence.dueDate.slice(0, 7) < openMonth && occurrence.status !== "due");
}

export function resolveDragMove({
  occurrence,
  target,
  currentMonth,
  openMonth = currentMonth,
}: {
  occurrence: ExpenseOccurrence;
  target: Pick<DropTarget, "date" | "rowId">;
  currentMonth: string;
  openMonth?: string;
}): DragMoveAction {
  if (!isDropTargetAllowed(target, currentMonth, openMonth)) return "ignore";
  if (target.date === occurrence.dueDate && !target.rowId) return "ignore";
  if (!canMoveOccurrence(occurrence, openMonth)) return "ignore";
  if (occurrence.record || occurrence.dueDate.slice(0, 7) < currentMonth) {
    return "single";
  }
  return "series";
}

export function isDropTargetAllowed(
  target: (Partial<DropTarget> & Pick<DropTarget, "date">) | null,
  currentMonth: string,
  openMonth: string = currentMonth,
) {
  const floor = currentMonth > openMonth ? currentMonth : openMonth;
  return Boolean(target && target.date.slice(0, 7) >= floor);
}
