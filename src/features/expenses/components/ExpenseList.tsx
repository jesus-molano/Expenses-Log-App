"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { enUS, es } from "date-fns/locale";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { useExpenseDnd } from "../hooks/use-expense-dnd";
import { useTimelineInitialFocus } from "../hooks/use-timeline-initial-focus";
import { visibleSectionsDuringMonthDrag } from "../lib/timeline-expanded-month";
import type { TimelineSection } from "../lib/timeline";
import { ExpenseDragPreview } from "./ExpenseDragPreview";
import { TimelineEmptyState } from "./TimelineEmptyState";
import { TimelineMovePrompt } from "./TimelineMovePrompt";
import { TimelineSectionBlock } from "./TimelineSectionBlock";

type ExpenseListProps = {
  sections: TimelineSection[];
  categories: ExpenseCategory[];
  today: string;
  language?: AppLanguage;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onMoveOccurrence: (
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) => void;
  onMoveOccurrenceSeries: (occurrence: ExpenseOccurrence, dueDate: string) => void;
};

export function ExpenseList({
  sections,
  categories,
  today,
  language = "es",
  onTogglePaid,
  onMoveOccurrence,
  onMoveOccurrenceSeries,
}: ExpenseListProps) {
  const locale = language === "en" ? enUS : es;
  const currentMonth = today.slice(0, 7);
  const { focusIndex, focusRef } = useTimelineInitialFocus(sections, today);
  const dnd = useExpenseDnd({
    sections,
    onMoveOccurrence,
    onMoveOccurrenceSeries,
  });
  const visibleSections = visibleSectionsDuringMonthDrag({
    sections,
    currentMonth,
    draggedOccurrence: dnd.draggedOccurrence,
  });
  const activeCategory = dnd.activeOccurrence
    ? categories.find(
        (category) => category.id === dnd.activeOccurrence?.template.categoryId,
      )
    : undefined;

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      onDragStart={dnd.dndHandlers.onDragStart}
      onDragMove={dnd.dndHandlers.onDragMove}
      onDragEnd={dnd.dndHandlers.onDragEnd}
      onDragCancel={dnd.dndHandlers.onDragCancel}
    >
      <section>
        {sections.length ? (
          <div className="relative space-y-5 pb-8">
            {visibleSections.map((section, index) => (
              <TimelineSectionBlock
                key={section.id}
                section={section}
                allSections={sections}
                index={index}
                today={today}
                currentMonth={currentMonth}
                focusRef={index === focusIndex ? focusRef : undefined}
                categories={categories}
                language={language}
                locale={locale}
                draggedOccurrence={dnd.draggedOccurrence}
                activeOccurrence={dnd.activeOccurrence}
                activeDropTarget={dnd.activeDropTarget}
                onTogglePaid={onTogglePaid}
              />
            ))}
          </div>
        ) : (
          <TimelineEmptyState language={language} />
        )}

        <TimelineMovePrompt
          pendingMove={dnd.pendingMove}
          language={language}
          locale={locale}
          onApplySeries={dnd.applySeriesMove}
          onClose={dnd.closeMoveSheet}
        />
      </section>

      <DragOverlay dropAnimation={null}>
        <ExpenseDragPreview
          occurrence={dnd.activeOccurrence}
          category={activeCategory}
          today={today}
          language={language}
        />
      </DragOverlay>
    </DndContext>
  );
}
