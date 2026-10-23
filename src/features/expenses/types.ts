import type { PreviousChargesResolution } from "@/domain/types";

// Respuesta a "¿Cómo quedan los cobros anteriores?" de un gasto que empezó en
// un mes pasado: pagados, saltados o pendientes (se dejan como están).
export type PreviousChargesChoiceValue = PreviousChargesResolution | "due";

export function previousChargesOption(
  choice: PreviousChargesChoiceValue,
): PreviousChargesResolution | undefined {
  return choice === "due" ? undefined : choice;
}
