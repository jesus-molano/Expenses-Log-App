"use client";

import type { Locale } from "date-fns";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import type { DropTarget } from "../hooks/use-expense-dnd";
import { getExpandedSectionDays } from "../lib/timeline-expanded-month";
import type { TimelineSection } from "../lib/timeline";
import { TimelineExpandedMonth } from "./timeline/TimelineExpandedMonth";
import { TimelineNormalItems } from "./timeline/TimelineNormalItems";
import { TimelineSectionHeader } from "./timeline/TimelineSectionHeader";
import { TimelineSectionRail } from "./timeline/TimelineSectionRail";

type TimelineSectionBlockProps = {
  section: TimelineSection;
  allSections: TimelineSection[];
  index: number;
  today: string;
  currentMonth: string;
  focusRef?: React.Ref<HTMLElement>;
  categories: ExpenseCategory[];
  language: AppLanguage;
  locale: Locale;
  draggedOccurrence: ExpenseOccurrence | null;
  activeOccurrence: ExpenseOccurrence | null;
  activeDropTarget: DropTarget | null;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function TimelineSectionBlock({
  section,
  allSections,
  index,
  today,
  currentMonth,
  focusRef,
  categories,
  language,
  locale,
  draggedOccurrence,
  activeOccurrence,
  activeDropTarget,
  onTogglePaid,
}: TimelineSectionBlockProps) {
  const expandedDays = getExpandedSectionDays({
    section,
    draggedOccurrence,
    currentMonth,
  });
  const isExpandedMonthDrag = expandedDays.length > 0;
  const sectionItemDates = new Set(section.items.map((item) => item.dueDate));
  const emptyDaysBefore = expandedDays.filter(
    (day) => day < (draggedOccurrence?.dueDate ?? "") && !sectionItemDates.has(day),
  );
  const emptyDaysAfter = expandedDays.filter(
    (day) => day > (draggedOccurrence?.dueDate ?? "") && !sectionItemDates.has(day),
  );

  return (
    <article
      ref={focusRef}
      data-section-id={section.id}
      data-timeline-date={section.anchorDate}
      className="relative scroll-mt-32 pl-4"
    >
      <TimelineSectionRail tone={section.tone} activeToday={section.id === "today"} />
      <TimelineSectionHeader section={section} today={today} />

      <div
        className={`space-y-1.5 transition-opacity duration-200 ${
          index > 2 ? "opacity-90" : ""
        }`}
      >
        {isExpandedMonthDrag ? (
          <TimelineExpandedMonth
            dates={expandedDays}
            allSections={allSections}
            categories={categories}
            today={today}
            language={language}
            locale={locale}
            activeOccurrence={activeOccurrence}
            activeDropTarget={activeDropTarget}
            onTogglePaid={onTogglePaid}
          />
        ) : (
          <TimelineNormalItems
            section={section}
            emptyDaysBefore={emptyDaysBefore}
            emptyDaysAfter={emptyDaysAfter}
            categories={categories}
            today={today}
            language={language}
            locale={locale}
            activeOccurrence={activeOccurrence}
            activeDropTarget={activeDropTarget}
            onTogglePaid={onTogglePaid}
          />
        )}
      </div>
    </article>
  );
}
