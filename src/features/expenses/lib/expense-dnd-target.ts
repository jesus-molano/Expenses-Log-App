import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";

export type DropTarget = {
  date: string;
  position: "before" | "after";
  rowId?: string;
};

export function getDropTargetFromEvent(
  event: DragMoveEvent | DragEndEvent,
): DropTarget | null {
  const over = event.over;
  if (!over?.data.current) return null;

  const data = over.data.current as {
    date?: string;
    rowId?: string;
    position?: "before" | "after";
    type?: string;
  };
  if (!data.date) return null;
  if (data.position) {
    return {
      date: data.date,
      rowId: data.rowId,
      position: data.position,
    };
  }

  const overRect = over.rect;
  const activeTop = event.active.rect.current.translated?.top;
  const activeHeight = event.active.rect.current.translated?.height ?? 0;
  const activeCenter =
    activeTop === undefined ? overRect.top : activeTop + activeHeight / 2;

  return {
    date: data.date,
    rowId: data.rowId,
    position:
      activeCenter < overRect.top + overRect.height / 2 ? "before" : "after",
  };
}
