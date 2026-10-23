import type { ExpenseOccurrence } from "@/domain/types";
import type { DropTarget } from "./expense-dnd-target";

export type DragMoveAction = "ignore" | "single" | "series";

// Qué hacer al soltar un gasto en la timeline.
// - Nunca se suelta en un mes ya cerrado: sacaría el cobro de los totales del
//   mes en curso.
// - Lo pendiente de meses anteriores (o con registro histórico) solo mueve ese
//   cobro: cambiar la serie desde ahí reescribiría meses cerrados.
export function resolveDragMove({
  occurrence,
  target,
  currentMonth,
}: {
  occurrence: ExpenseOccurrence;
  target: Pick<DropTarget, "date" | "rowId">;
  currentMonth: string;
}): DragMoveAction {
  if (target.date.slice(0, 7) < currentMonth) return "ignore";
  if (target.date === occurrence.dueDate && !target.rowId) return "ignore";
  if (occurrence.record || occurrence.dueDate.slice(0, 7) < currentMonth) {
    return "single";
  }
  return "series";
}

export function isDropTargetAllowed(target: DropTarget | null, currentMonth: string) {
  return Boolean(target && target.date.slice(0, 7) >= currentMonth);
}
