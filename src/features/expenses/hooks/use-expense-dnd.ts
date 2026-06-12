"use client";

import type {
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
const DRAG_SCROLL_ANCHOR_SETTLE_MS = [0, 80, 180, 360, 560] as const;

type DragScrollAnchor = {
  selector: string;
  top: number;
  fallbackScrollY: number;
};

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
  const scrollAnchorTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      clearDragSettleTimeout(settleTimeoutRef.current);
      clearScrollAnchorTimeouts(scrollAnchorTimeoutsRef.current);
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
    const anchor = createDragScrollAnchor(occurrence, target);

    cleanupDrag(anchor);

    if (!occurrence || !target) return;
    if (target.date !== occurrence.dueDate || target.rowId) {
      scheduleSeriesMove(occurrence, target.date, target);
    }
  }

  function handleDragCancel() {
    cleanupDrag();
  }

  function cleanupDrag(
    anchor: DragScrollAnchor | null = createDragScrollAnchor(activeOccurrence, null),
  ) {
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
    stabilizeScrollAfterDrag(anchor);
  }

  function stabilizeScrollAfterDrag(anchor: DragScrollAnchor | null) {
    clearScrollAnchorTimeouts(scrollAnchorTimeoutsRef.current);
    scrollAnchorTimeoutsRef.current = [];
    if (!anchor) return;

    const stabilize = () => {
      const element = document.querySelector<HTMLElement>(anchor.selector);
      if (!element) {
        window.scrollTo({ top: anchor.fallbackScrollY, behavior: "auto" });
        return;
      }

      const nextTop = element.getBoundingClientRect().top;
      const delta = nextTop - anchor.top;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy({ top: delta, behavior: "auto" });
      }
    };

    window.requestAnimationFrame(() => {
      stabilize();
      window.requestAnimationFrame(stabilize);
    });

    scrollAnchorTimeoutsRef.current = DRAG_SCROLL_ANCHOR_SETTLE_MS.map((delay) =>
      window.setTimeout(stabilize, delay),
    );
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
      onDragCancel: handleDragCancel,
    },
  };
}

function clearDragSettleTimeout(timeoutId: number | null) {
  if (timeoutId !== null) window.clearTimeout(timeoutId);
}

function clearScrollAnchorTimeouts(timeoutIds: number[]) {
  for (const timeoutId of timeoutIds) {
    window.clearTimeout(timeoutId);
  }
  timeoutIds.length = 0;
}

function createDragScrollAnchor(
  occurrence: ExpenseOccurrence | null,
  target: DropTarget | null,
): DragScrollAnchor | null {
  const selectors = [
    target?.rowId ? rowSelector(target.rowId) : null,
    target?.date ? `[data-timeline-date="${cssEscape(target.date)}"]` : null,
    occurrence ? rowSelector(occurrence.id) : null,
    occurrence?.dueDate
      ? `[data-timeline-date="${cssEscape(occurrence.dueDate)}"]`
      : null,
  ].filter(Boolean) as string[];

  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      return {
        selector,
        top: element.getBoundingClientRect().top,
        fallbackScrollY: window.scrollY,
      };
    }
  }

  return null;
}

function rowSelector(rowId: string) {
  return `[data-expense-row-id="${cssEscape(rowId)}"]`;
}

function cssEscape(value: string) {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/"/g, '\\"');
}
