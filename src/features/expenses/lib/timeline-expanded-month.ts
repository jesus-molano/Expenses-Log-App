import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { ExpenseOccurrence } from "@/domain/types";
import type { TimelineSection } from "./timeline";

export function getExpandedSectionDays({
  section,
  draggedOccurrence,
  currentMonth,
}: {
  section: TimelineSection;
  draggedOccurrence: ExpenseOccurrence | null;
  currentMonth: string;
}) {
  const shouldExpand =
    Boolean(draggedOccurrence) &&
    draggedOccurrence?.dueDate.slice(0, 7) === currentMonth &&
    section.anchorDate.slice(0, 7) === currentMonth &&
    section.items.some((item) => item.id === draggedOccurrence?.id);

  if (!shouldExpand) return [];

  return eachDayOfInterval({
    start: startOfMonth(parseISO(section.anchorDate)),
    end: endOfMonth(parseISO(section.anchorDate)),
  }).map((date) => format(date, "yyyy-MM-dd"));
}

export function groupMonthItemsByDate(
  allSections: TimelineSection[],
  firstExpandedDay?: string,
) {
  const month = firstExpandedDay?.slice(0, 7) ?? "";
  const itemsByDate = new Map<string, ExpenseOccurrence[]>();

  for (const item of allSections.flatMap((section) => section.items)) {
    if (item.dueDate.slice(0, 7) !== month) continue;
    const items = itemsByDate.get(item.dueDate) ?? [];
    items.push(item);
    itemsByDate.set(item.dueDate, items);
  }

  for (const [date, items] of itemsByDate.entries()) {
    itemsByDate.set(date, [...items].sort(sortTimelineItems));
  }

  return itemsByDate;
}

export function visibleSectionsDuringMonthDrag({
  sections,
  currentMonth,
  draggedOccurrence,
}: {
  sections: TimelineSection[];
  currentMonth: string;
  draggedOccurrence: ExpenseOccurrence | null;
}) {
  const draggedMonth = draggedOccurrence?.dueDate.slice(0, 7) ?? null;
  const ownerSectionId = draggedOccurrence
    ? sections.find((section) =>
        section.items.some((item) => item.id === draggedOccurrence.id),
      )?.id
    : null;

  return sections.filter((section) => {
    if (!draggedMonth || draggedMonth !== currentMonth) return true;
    if (section.anchorDate.slice(0, 7) !== draggedMonth) return true;
    return section.id === ownerSectionId;
  });
}

function sortTimelineItems(a: ExpenseOccurrence, b: ExpenseOccurrence) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.template.name.localeCompare(b.template.name);
}
