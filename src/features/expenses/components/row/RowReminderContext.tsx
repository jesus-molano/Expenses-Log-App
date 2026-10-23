"use client";

import { createContext, useContext } from "react";
import type { ExpenseOccurrence, ReminderPreferences } from "@/domain/types";

export type RowReminderControls = {
  preferences: ReminderPreferences;
  onToggle: (occurrence: ExpenseOccurrence) => void;
};

// La campana de las filas sin pasar props por todo el timeline: sin
// proveedor (vista previa del arrastre, otras listas) no se pinta.
const RowReminderContext = createContext<RowReminderControls | null>(null);

export const RowReminderProvider = RowReminderContext.Provider;

export function useRowReminderControls() {
  return useContext(RowReminderContext);
}
