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
  // Mes que se mira: el arrastre de la serie solo se ofrece dentro de él.
  monthId?: string;
  // Mes natural: los anteriores están cerrados para el arrastre.
  openMonthId?: string;
  // Con el ciclo anclado al cobro, primer día en que se puede soltar.
  dropFloorDate?: string;
  // Si un cobro se puede arrastrar: la misma regla que sus acciones.
  canMoveOccurrence?: (occurrence: ExpenseOccurrence) => boolean;
  // false si encima hay algo que el desplazamiento inicial taparía.
  autoScroll?: boolean;
  language?: AppLanguage;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onOpenOccurrence: (occurrence: ExpenseOccurrence) => void;
  onMoveOccurrenceOnly: (
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
  monthId = today.slice(0, 7),
  openMonthId = today.slice(0, 7),
  dropFloorDate,
  canMoveOccurrence,
  autoScroll = true,
  language = "es",
  onTogglePaid,
  onOpenOccurrence,
  onMoveOccurrenceOnly,
  onMoveOccurrenceSeries,
}: ExpenseListProps) {
  const locale = language === "en" ? enUS : es;
  const currentMonth = monthId;
  const { focusIndex, focusRef } = useTimelineInitialFocus(sections, today, autoScroll);
  const dnd = useExpenseDnd({
    sections,
    currentMonth,
    openMonth: openMonthId,
    floorDate: dropFloorDate,
    canMove: canMoveOccurrence,
    onMoveOccurrenceOnly,
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
                onOpenOccurrence={onOpenOccurrence}
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
          onApplySingleMonth={dnd.applySingleMonthMove}
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
