import { addDays, addMonths, addYears, endOfMonth, parseISO, subYears } from "date-fns";
import { resolveActiveMonth } from "./budget-month";
import { toDateOnly } from "./calendar";
import { generateStoreOccurrences } from "./finance";
import {
  currentOrNextPause,
  generateTemplateDates,
  templateAmountOn,
} from "./recurrence";
import type {
  ExpensePause,
  ExpenseStore,
  ExpenseTemplate,
  FinanceStore,
} from "./types";

// Hasta dónde se buscan cobros pagados por adelantado.
const PREPAID_HORIZON_MONTHS = 13;
// Horizonte para encontrar los próximos cobros (un anual necesita años).
const CHOICE_HORIZON_YEARS = 3;

// Importe de la serie para lo que empieza ahora: el vigente hoy o, si el mes
// activo ya es el siguiente, el de su día 1. Es el que cambia "Desde este mes".
export function currentSeriesAmount(
  template: ExpenseTemplate,
  today: string,
  closures?: FinanceStore["monthClosures"],
): number {
  const activeStart = `${resolveActiveMonth(today, closures)}-01`;
  return templateAmountOn(template, activeStart > today ? activeStart : today);
}

// Si tiene sentido proponer un importe nuevo para los próximos cobros: la serie
// se repite y no ha terminado.
export function seriesHasUpcomingCharges(template: ExpenseTemplate, today: string) {
  return (
    template.recurrence.frequency !== "once" &&
    (!template.endDate || template.endDate >= today)
  );
}

// Cobros de la serie desde una fecha (los de meses cerrados como registros),
// hasta 13 meses después de esa fecha o de hoy.
export function seriesOccurrencesFrom(
  store: ExpenseStore,
  templateId: string,
  from: string,
  today: Date,
) {
  const start = parseISO(from) > today ? parseISO(from) : today;
  const to = toDateOnly(endOfMonth(addMonths(start, PREPAID_HORIZON_MONTHS)));
  return generateStoreOccurrences(store, from, to).filter(
    (occurrence) => occurrence.template.id === templateId,
  );
}

// Fecha del último cobro pagado de la serie en los meses abiertos (también
// los adelantados): lo que una pausa o un final no deben tapar.
export function latestPaidChargeDate(
  store: ExpenseStore,
  templateId: string,
  today: Date = new Date(),
): string | null {
  return (
    seriesOccurrencesFrom(store, templateId, `${toDateOnly(today).slice(0, 7)}-01`, today)
      .filter((occurrence) => occurrence.status === "paid")
      .map((occurrence) => occurrence.occurrenceDate)
      .sort()
      .at(-1) ?? null
  );
}

export type ChargeChoice = {
  date: string;
  paid: boolean;
};

// Cobros que pueden ser el último al finalizar: el último del mes pasado y
// los siguientes, nunca antes de uno ya pagado.
export function endChargeChoices(
  store: ExpenseStore,
  template: ExpenseTemplate,
  today: Date,
  count = 6,
): ChargeChoice[] {
  const monthStart = `${toDateOnly(today).slice(0, 7)}-01`;
  const lastPaid = latestPaidChargeDate(store, template.id, today);
  const previous = generateTemplateDates(
    template,
    toDateOnly(subYears(parseISO(monthStart), CHOICE_HORIZON_YEARS)),
    toDateOnly(addDays(parseISO(monthStart), -1)),
  ).at(-1);
  const upcoming = generateTemplateDates(
    template,
    monthStart,
    toDateOnly(addYears(today, CHOICE_HORIZON_YEARS)),
  );

  const statusByDate = new Map(
    seriesOccurrencesFrom(store, template.id, previous ?? monthStart, today).map(
      (occurrence) => [occurrence.occurrenceDate, occurrence.status],
    ),
  );

  return [...(previous ? [previous] : []), ...upcoming]
    .filter((date) => !lastPaid || date >= lastPaid)
    .slice(0, count)
    .map((date) => ({ date, paid: statusByDate.get(date) === "paid" }));
}

// Primer cobro que se puede saltar al pausar: los pendientes desde este mes,
// después del último pagado.
export function pauseStartChoices(
  store: ExpenseStore,
  template: ExpenseTemplate,
  today: Date,
  count = 6,
): string[] {
  const lastPaid = latestPaidChargeDate(store, template.id, today);
  return generateTemplateDates(
    template,
    `${toDateOnly(today).slice(0, 7)}-01`,
    toDateOnly(addYears(today, CHOICE_HORIZON_YEARS)),
  )
    .filter((date) => !lastPaid || date > lastPaid)
    .slice(0, count);
}

// Cobros con los que puede volver la serie tras pausarla desde `from`.
export function pauseResumeChoices(
  template: ExpenseTemplate,
  from: string,
  count = 12,
): string[] {
  return generateTemplateDates(
    template,
    toDateOnly(addDays(parseISO(from), 1)),
    toDateOnly(addYears(parseISO(from), CHOICE_HORIZON_YEARS)),
  ).slice(0, count);
}

// La pausa que va hasta el día anterior al cobro con el que vuelve (sin
// vuelta, hasta reanudarla).
export function pauseUntilResume(from: string, resumeOn?: string): ExpensePause {
  return resumeOn
    ? { from, to: toDateOnly(addDays(parseISO(resumeOn), -1)) }
    : { from };
}

export type SeriesLifecycle = {
  // Fin configurado y el último cobro que llega a generarse.
  end: { date: string; lastCharge: string | null; past: boolean } | null;
  // Pausa que afecta hoy o la próxima, con el cobro con el que vuelve.
  pause: {
    pause: ExpensePause;
    active: boolean;
    firstSkipped: string | null;
    resumesOn: string | null;
  } | null;
};

export function seriesLifecycle(
  template: ExpenseTemplate,
  today: string,
): SeriesLifecycle {
  const end = template.endDate
    ? {
        date: template.endDate,
        lastCharge:
          generateTemplateDates(
            template,
            toDateOnly(subYears(parseISO(template.endDate), CHOICE_HORIZON_YEARS)),
            template.endDate,
          ).at(-1) ?? null,
        past: template.endDate < today,
      }
    : null;
  const current = currentOrNextPause(template.pauses, today);
  if (!current) return { end, pause: null };

  const { pause } = current;
  const unpaused = { ...template, pauses: undefined };
  const firstSkipped =
    generateTemplateDates(
      unpaused,
      pause.from,
      pause.to ?? toDateOnly(addYears(parseISO(pause.from), CHOICE_HORIZON_YEARS)),
    )[0] ?? null;
  const resumesOn = pause.to
    ? (generateTemplateDates(
        template,
        toDateOnly(addDays(parseISO(pause.to), 1)),
        toDateOnly(addYears(parseISO(pause.to), CHOICE_HORIZON_YEARS)),
      )[0] ?? null)
    : null;

  return { end, pause: { pause, active: current.active, firstSkipped, resumesOn } };
}
