import type { ExpenseOccurrence } from "@/domain/types";
import type { TimelineSection } from "./timeline";

type SortDropTarget = {
  rowId?: string;
  position: "before" | "after";
};

type GetDropSortOrderOptions = {
  sections: TimelineSection[];
  occurrenceId: string;
  target?: SortDropTarget | null;
};

export function getDropSortOrder({
  sections,
  occurrenceId,
  target,
}: GetDropSortOrderOptions): number | undefined {
  if (!target?.rowId) return undefined;

  const targetSection = sections.find((section) =>
    section.items.some((item) => item.id === target.rowId),
  );
  if (!targetSection) return undefined;

  const orderedItems = targetSection.items.filter(
    (item) => item.id !== occurrenceId,
  );
  const targetIndex = orderedItems.findIndex((item) => item.id === target.rowId);
  if (targetIndex < 0) return undefined;

  const insertIndex = target.position === "before" ? targetIndex : targetIndex + 1;
  return midpointSortOrder(
    orderedItems[insertIndex - 1],
    orderedItems[insertIndex],
  );
}

function midpointSortOrder(
  previous?: ExpenseOccurrence,
  next?: ExpenseOccurrence,
) {
  if (previous && next) {
    if (previous.sortOrder === next.sortOrder) return previous.sortOrder + 0.5;
    return previous.sortOrder + (next.sortOrder - previous.sortOrder) / 2;
  }

  if (previous) return previous.sortOrder + 512;
  if (next) return next.sortOrder - 512;
  return 0;
}
