"use client";

import { clearExpenseLocalData } from "./local-store";
import { clearSnapshots } from "./snapshot-store";

// Borra los datos de gastos que la app guarda en este dispositivo: el store y
// sus metadatos de sync (localStorage) y las copias automáticas (IndexedDB),
// que también llevan el store entero. Para cerrar sesión en un equipo que no
// es tuyo y al eliminar la cuenta.
export async function clearDeviceData(): Promise<void> {
  clearExpenseLocalData();
  await clearSnapshots();
}
