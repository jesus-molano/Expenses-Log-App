"use client";

import { useState } from "react";
import type { IncomeEvent } from "@/domain/types";

// Quitar un ingreso puntual no se puede deshacer: se pide confirmación.
export function useIncomeRemovalConfirmation(
  incomeEvents: IncomeEvent[],
  onRemoveIncomeEvent: (id: string) => void,
) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Si el ingreso desaparece mientras tanto (otro dispositivo), el diálogo se
  // cierra solo.
  const incomeToRemove =
    incomeEvents.find((event) => event.id === pendingId) ?? null;

  function confirmRemoval() {
    if (!incomeToRemove) return;
    onRemoveIncomeEvent(incomeToRemove.id);
    setPendingId(null);
  }

  return {
    incomeToRemove,
    requestRemoval: setPendingId,
    cancelRemoval: () => setPendingId(null),
    confirmRemoval,
  };
}
