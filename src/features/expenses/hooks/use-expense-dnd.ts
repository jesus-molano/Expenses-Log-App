"use client";

import {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import type { ExpenseOccurrence } from "@/domain/types";
import { getDropSortOrder } from "../lib/dnd-sort-order";
import { rowFirstCollisionDetection } from "../lib/expense-dnd-collision";
import {
  getDropTargetFromEvent,
  type DropTarget,
} from "../lib/expense-dnd-target";
import type { TimelineSection } from "../lib/timeline";
import { useExpenseDndAutoScroll } from "./use-expense-dnd-auto-scroll";
import { useExpenseDndPrompt } from "./use-expense-dnd-prompt";
import { useExpenseDndSensors } from "./use-expense-dnd-sensors";
export type { DropTarget } from "../lib/expense-dnd-target";

type UseExpenseDndOptions = {
  sections: TimelineSection[];
  onMoveOccurrence: (
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) => void;
  onMoveOccurrenceSeries: (
    occurrence: ExpenseOccurrence,
    dueDate: string,
  ) => void;
};

export function useExpenseDnd({
  sections,
  onMoveOccurrence,
  onMoveOccurrenceSeries,
}: UseExpenseDndOptions) {
  const [draggedOccurrence, setDraggedOccurrence] =
    useState<ExpenseOccurrence | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(null);
  const [activeOccurrence, setActiveOccurrence] =
    useState<ExpenseOccurrence | null>(null);
  const sensors = useExpenseDndSensors();
  const autoScrollWithDrag = useExpenseDndAutoScroll();
  const prompt = useExpenseDndPrompt(onMoveOccurrenceSeries);

  function scheduleMove(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    target?: DropTarget | null,
  ) {
    const sortOrder = getDropSortOrder({
      sections,
      occurrenceId: occurrence.id,
      target,
    });

    onMoveOccurrence(occurrence, dueDate, sortOrder);
    prompt.requestMovePrompt(occurrence, dueDate);
  }

  function handleDragStart(event: DragStartEvent) {
    const occurrence = event.active.data.current?.occurrence as
      | ExpenseOccurrence
      | undefined;
    if (!occurrence) return;

    document.documentElement.classList.add("is-dragging-expense");
    setActiveOccurrence(occurrence);
    setDraggedOccurrence(occurrence);
  }

  function handleDragMove(event: DragMoveEvent) {
    autoScrollWithDrag(event);
    setActiveDropTarget(getDropTargetFromEvent(event));
  }

  function handleDragEnd(event: DragEndEvent) {
    const target = getDropTargetFromEvent(event);
    const occurrence = activeOccurrence;

    cleanupDrag();

    if (!occurrence || !target) return;
    if (target.date !== occurrence.dueDate || target.rowId) {
      scheduleMove(occurrence, target.date, target);
    }
  }

  function cleanupDrag() {
    document.documentElement.classList.remove("is-dragging-expense");
    setActiveOccurrence(null);
    setDraggedOccurrence(null);
    setActiveDropTarget(null);
  }

  return {
    sensors,
    collisionDetection: rowFirstCollisionDetection,
    activeOccurrence,
    draggedOccurrence,
    activeDropTarget,
    pendingMove: prompt.pendingMove,
    closeMoveSheet: prompt.closeMoveSheet,
    applySeriesMove: prompt.applySeriesMove,
    dndHandlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onDragCancel: cleanupDrag,
    },
  };
}
