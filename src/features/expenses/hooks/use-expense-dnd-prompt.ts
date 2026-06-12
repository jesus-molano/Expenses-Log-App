"use client";

import { useState } from "react";
import type { ExpenseOccurrence } from "@/domain/types";

type PendingMove = {
  occurrence: ExpenseOccurrence;
  dueDate: string;
  sortOrder?: number;
};

export function useExpenseDndPrompt(
  onMoveOccurrenceOnly: (
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) => void,
) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  function requestMovePrompt(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    setPendingMove({ occurrence, dueDate, sortOrder });
  }

  function closeMoveSheet() {
    setPendingMove(null);
  }

  function applySingleMonthMove() {
    if (!pendingMove) return;

    onMoveOccurrenceOnly(
      pendingMove.occurrence,
      pendingMove.dueDate,
      pendingMove.sortOrder,
    );
    setPendingMove(null);
  }

  return {
    pendingMove,
    requestMovePrompt,
    closeMoveSheet,
    applySingleMonthMove,
  };
}
