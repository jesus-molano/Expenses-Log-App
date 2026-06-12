"use client";

import {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
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

const DRAG_SETTLE_LOCK_MS = 520;

type UseExpenseDndOptions = {
  sections: TimelineSection[];
  onMoveOccurrenceOnly: (
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
  onMoveOccurrenceOnly,
  onMoveOccurrenceSeries,
}: UseExpenseDndOptions) {
  const [draggedOccurrence, setDraggedOccurrence] =
    useState<ExpenseOccurrence | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(null);
  const [activeOccurrence, setActiveOccurrence] =
    useState<ExpenseOccurrence | null>(null);
  const sensors = useExpenseDndSensors();
  const autoScrollWithDrag = useExpenseDndAutoScroll();
  const prompt = useExpenseDndPrompt(onMoveOccurrenceOnly);
  const settleTimeoutRef = useRef<number | null>(null);
  const releaseScrollYRef = useRef(0);

  useEffect(() => {
    return () => {
      clearDragSettleTimeout(settleTimeoutRef.current);
      document.documentElement.classList.remove(
        "is-dragging-expense",
        "is-settling-expense-drag",
      );
    };
  }, []);

  function scheduleSeriesMove(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    target?: DropTarget | null,
  ) {
    const sortOrder = getDropSortOrder({
      sections,
      occurrenceId: occurrence.id,
      target,
    });

    onMoveOccurrenceSeries(occurrence, dueDate);
    prompt.requestMovePrompt(occurrence, dueDate, sortOrder);
  }

  function handleDragStart(event: DragStartEvent) {
    const occurrence = event.active.data.current?.occurrence as
      | ExpenseOccurrence
      | undefined;
    if (!occurrence) return;

    clearDragSettleTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = null;
    document.documentElement.classList.remove("is-settling-expense-drag");
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
      scheduleSeriesMove(occurrence, target.date, target);
    }
  }

  function cleanupDrag() {
    releaseScrollYRef.current = window.scrollY;
    document.documentElement.classList.remove("is-dragging-expense");
    document.documentElement.classList.add("is-settling-expense-drag");
    clearDragSettleTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("is-settling-expense-drag");
      settleTimeoutRef.current = null;
    }, DRAG_SETTLE_LOCK_MS);
    setActiveOccurrence(null);
    setDraggedOccurrence(null);
    setActiveDropTarget(null);
    stabilizeScrollAfterDrag();
  }

  function stabilizeScrollAfterDrag() {
    const releaseScrollY = releaseScrollYRef.current;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: releaseScrollY, behavior: "auto" });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: releaseScrollY, behavior: "auto" });
      });
    });
  }

  return {
    sensors,
    collisionDetection: rowFirstCollisionDetection,
    activeOccurrence,
    draggedOccurrence,
    activeDropTarget,
    pendingMove: prompt.pendingMove,
    closeMoveSheet: prompt.closeMoveSheet,
    applySingleMonthMove: prompt.applySingleMonthMove,
    dndHandlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onDragCancel: cleanupDrag,
    },
  };
}

function clearDragSettleTimeout(timeoutId: number | null) {
  if (timeoutId !== null) window.clearTimeout(timeoutId);
}
