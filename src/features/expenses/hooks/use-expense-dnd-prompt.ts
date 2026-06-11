"use client";

import { useState } from "react";
import type { ExpenseOccurrence } from "@/domain/types";

type PendingMove = {
  occurrence: ExpenseOccurrence;
  dueDate: string;
};

export function useExpenseDndPrompt(
  onMoveOccurrenceSeries: (occurrence: ExpenseOccurrence, dueDate: string) => void,
) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  function requestMovePrompt(occurrence: ExpenseOccurrence, dueDate: string) {
    setPendingMove({ occurrence, dueDate });
  }

  function closeMoveSheet() {
    setPendingMove(null);
  }

  function applySeriesMove() {
    if (!pendingMove) return;

    onMoveOccurrenceSeries(pendingMove.occurrence, pendingMove.dueDate);
    setPendingMove(null);
  }

  return {
    pendingMove,
    requestMovePrompt,
    closeMoveSheet,
    applySeriesMove,
  };
}
