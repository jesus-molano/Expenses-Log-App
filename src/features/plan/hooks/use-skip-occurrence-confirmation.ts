"use client";

import { useState } from "react";
import type { ExpenseOccurrence } from "@/domain/types";

export function useSkipOccurrenceConfirmation(
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void,
) {
  const [occurrenceToSkip, setOccurrenceToSkip] =
    useState<ExpenseOccurrence | null>(null);

  function confirmSkipOccurrence() {
    if (!occurrenceToSkip) return;
    onSkipOccurrence(occurrenceToSkip);
    setOccurrenceToSkip(null);
  }

  return {
    occurrenceToSkip,
    requestSkipOccurrence: setOccurrenceToSkip,
    cancelSkipOccurrence: () => setOccurrenceToSkip(null),
    confirmSkipOccurrence,
  };
}
