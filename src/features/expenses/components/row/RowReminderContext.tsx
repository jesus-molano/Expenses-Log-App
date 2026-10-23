"use client";

import { createContext, useContext } from "react";
import type { ResolvedReminder } from "@/domain/reminder-schedule";
import type { ExpenseOccurrence, ReminderPreferences } from "@/domain/types";

export type RowReminderControls = {
  preferences: ReminderPreferences;
  // Aviso de la serie actual del cobro, o null si el gasto ya no existe o
  // está inactivo (los cobros de meses cerrados llegan como registros).
  reminderFor: (occurrence: ExpenseOccurrence) => ResolvedReminder | null;
  onToggle: (occurrence: ExpenseOccurrence) => void;
};

// La campana de las filas sin pasar props por todo el timeline: sin
// proveedor (vista previa del arrastre, otras listas) no se pinta.
const RowReminderContext = createContext<RowReminderControls | null>(null);

export const RowReminderProvider = RowReminderContext.Provider;

export function useRowReminderControls() {
  return useContext(RowReminderContext);
}
