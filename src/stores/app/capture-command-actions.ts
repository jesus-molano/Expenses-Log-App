import type { ResolvedCaptureCommand } from "@/domain/capture-commands";
import {
  occurrenceKeyOf,
  pickWinningOverride,
  type OccurrenceKey,
} from "@/domain/overrides";
import type { ExpenseOccurrenceOverride, ExpenseStore } from "@/domain/types";
import {
  moveOccurrenceInStore,
  moveOccurrenceSeriesInStore,
  payOccurrenceInStore,
  skipOccurrenceInStore,
  updateExpenseTemplateInStore,
} from "./expense-commands";
import { upsertOccurrenceOverride } from "./occurrence-overrides";

// Una orden confirmada en la revisión: el importe pagado puede haberse
// corregido y, al mover, el usuario elige si cambia la serie.
export type ConfirmedCaptureCommand = {
  resolved: ResolvedCaptureCommand;
  amount?: number | null;
  scope?: "single" | "series";
};

// Lo necesario para deshacer una orden aplicada.
export type CaptureCommandChange = {
  key: OccurrenceKey;
  previous: ExpenseOccurrenceOverride | undefined;
  // Día de cobro de la serie antes de moverla entera.
  previousDueDay?: number;
};

function currentOverride(store: ExpenseStore, key: OccurrenceKey) {
  const keyId = occurrenceKeyOf(key);
  return store.overrides
    .filter((override) => occurrenceKeyOf(override) === keyId)
    .reduce<ExpenseOccurrenceOverride | undefined>(
      (winner, override) => (winner ? pickWinningOverride(winner, override) : override),
      undefined,
    );
}

// Aplica las órdenes con los comandos de siempre (pagar, saltar, mover) en
// un solo cambio del store. Las que tienen algún problema no se aplican.
export function applyCaptureCommandsInStore(
  store: ExpenseStore,
  commands: ConfirmedCaptureCommand[],
): { store: ExpenseStore; changes: CaptureCommandChange[] } {
  let result = store;
  const changes: CaptureCommandChange[] = [];

  for (const { resolved, amount, scope = "single" } of commands) {
    const { occurrence, issue, command } = resolved;
    if (!occurrence || issue) continue;
    const key = { templateId: occurrence.template.id, occurrenceDate: occurrence.occurrenceDate };
    const previous = currentOverride(result, key);

    if (command.intent === "pay") {
      const paid = amount ?? resolved.amount ?? occurrence.template.amount;
      if (!Number.isFinite(paid) || paid <= 0) continue;
      result = payOccurrenceInStore(result, occurrence, paid);
      changes.push({ key, previous });
    } else if (command.intent === "skip") {
      result = skipOccurrenceInStore(result, occurrence);
      changes.push({ key, previous });
    } else if (resolved.newDueDate) {
      if (scope === "series" && resolved.canMoveSeries) {
        const previousDueDay = result.templates.find(
          (template) => template.id === occurrence.template.id,
        )?.dueDay;
        result = moveOccurrenceSeriesInStore(result, occurrence, resolved.newDueDate);
        changes.push({ key, previous, previousDueDay });
      } else {
        result = moveOccurrenceInStore(result, occurrence, resolved.newDueDate);
        changes.push({ key, previous });
      }
    }
  }

  return { store: result, changes };
}

// Deshace lo aplicado en orden inverso: devuelve el día de la serie (el
// rekey recoloca sus cobros) y el estado previo de cada cobro. Como siempre,
// sin borrar overrides: se restauran como patch.
export function revertCaptureCommandsInStore(
  store: ExpenseStore,
  changes: CaptureCommandChange[],
): ExpenseStore {
  return [...changes].reverse().reduce((current, change) => {
    const restored =
      change.previousDueDay !== undefined
        ? updateExpenseTemplateInStore(current, change.key.templateId, {
            dueDay: change.previousDueDay,
          })
        : current;
    const previous = change.previous;
    return upsertOccurrenceOverride(restored, change.key, {
      status: previous?.status ?? "due",
      paidAt: previous?.paidAt,
      amountPaid: previous?.amountPaid,
      dueDate: previous?.dueDate,
      sortOrder: previous?.sortOrder,
    });
  }, store);
}
