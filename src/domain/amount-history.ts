import { addDays, endOfMonth, parseISO, subMonths } from "date-fns";
import { toDateOnly } from "./calendar";
import { generateStoreOccurrences, paidAmountOf } from "./finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "./types";

// Hasta dónde se mira atrás para el historial y las sugerencias de importe.
const HISTORY_MONTHS = 24;

export type PaidAmountAverage = {
  amount: number;
  count: number;
};

// Media de lo pagado en los últimos cobros pagados (hasta `count`),
// redondeada al céntimo. Es la sugerencia para un recibo variable.
export function averagePaidAmount(
  occurrences: ExpenseOccurrence[],
  count = 3,
): PaidAmountAverage | null {
  const recent = occurrences
    .filter((occurrence) => occurrence.status === "paid")
    .sort(newestFirst)
    .slice(0, count);
  if (!recent.length) return null;

  const total = recent.reduce((sum, occurrence) => sum + paidAmountOf(occurrence), 0);
  return { amount: roundCents(total / recent.length), count: recent.length };
}

// Cobros de una serie en el rango, incluidos los de meses cerrados (que viven
// como registros), del más reciente al más antiguo.
export function templateOccurrencesBetween(
  store: ExpenseStore,
  templateId: string,
  fromDate: string,
  toDate: string,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  return generateStoreOccurrences(store, fromDate, toDate, language)
    .filter((occurrence) => occurrence.template.id === templateId)
    .sort(newestFirst);
}

// Sugerencia al pagar un cobro: la media de los 3 últimos pagos anteriores de
// la misma serie.
export function suggestedPaidAmount(
  store: ExpenseStore,
  templateId: string,
  occurrenceDate: string,
  language: AppLanguage = "es",
): PaidAmountAverage | null {
  const date = parseISO(occurrenceDate);
  return averagePaidAmount(
    templateOccurrencesBetween(
      store,
      templateId,
      toDateOnly(subMonths(date, HISTORY_MONTHS)),
      toDateOnly(addDays(date, -1)),
      language,
    ),
  );
}

export type ChargeHistoryEntry = {
  occurrence: ExpenseOccurrence;
  planned: number;
  // Solo en los pagados: lo que costó de verdad.
  paid: number | null;
  // Pagado menos previsto (0 si no está pagado o coincide).
  difference: number;
};

// Últimos cobros de una serie hasta el fin del mes en curso (y los ya pagados
// por adelantado), del más reciente al más antiguo, con lo previsto frente a
// lo pagado.
export function buildChargeHistory(
  store: ExpenseStore,
  templateId: string,
  today: string,
  { limit = 6, language = "es" }: { limit?: number; language?: AppLanguage } = {},
): ChargeHistoryEntry[] {
  const date = parseISO(today);
  const monthEnd = toDateOnly(endOfMonth(date));
  return templateOccurrencesBetween(
    store,
    templateId,
    toDateOnly(subMonths(date, HISTORY_MONTHS)),
    toDateOnly(endOfMonth(subMonths(date, -2))),
    language,
  )
    .filter(
      (occurrence) => occurrence.dueDate <= monthEnd || occurrence.status === "paid",
    )
    .slice(0, limit)
    .map((occurrence) => {
      const planned = occurrence.template.amount;
      const paid = occurrence.status === "paid" ? paidAmountOf(occurrence) : null;
      return {
        occurrence,
        planned,
        paid,
        difference: paid === null ? 0 : roundCents(paid - planned),
      };
    });
}

export type PriceHistoryEntry = {
  // Primer y último cobro con ese importe previsto.
  from: string;
  to: string;
  amount: number;
};

// Tramos del importe previsto de una serie hasta hoy, del más reciente al más
// antiguo: los cobros seguidos con el mismo importe forman un tramo. Los
// saltados no cuentan, porque no se pagaron.
export function buildPriceHistory(
  store: ExpenseStore,
  templateId: string,
  today: string,
  { limit = 6, language = "es" }: { limit?: number; language?: AppLanguage } = {},
): PriceHistoryEntry[] {
  const chronological = templateOccurrencesBetween(
    store,
    templateId,
    toDateOnly(subMonths(parseISO(today), HISTORY_MONTHS)),
    today,
    language,
  )
    .filter((occurrence) => occurrence.status !== "skipped")
    .reverse();
  const entries: PriceHistoryEntry[] = [];

  for (const occurrence of chronological) {
    const amount = occurrence.template.amount;
    const last = entries.at(-1);
    if (last && last.amount === amount) {
      last.to = occurrence.occurrenceDate;
    } else {
      entries.push({
        from: occurrence.occurrenceDate,
        to: occurrence.occurrenceDate,
        amount,
      });
    }
  }

  return entries.reverse().slice(0, limit);
}

function newestFirst(a: ExpenseOccurrence, b: ExpenseOccurrence) {
  return (
    b.occurrenceDate.localeCompare(a.occurrenceDate) ||
    b.dueDate.localeCompare(a.dueDate)
  );
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}
