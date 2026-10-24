import { addDays, addMonths, addYears, endOfMonth, parseISO, subYears } from "date-fns";
import { activeBudgetMonth } from "./budget-month";
import { isValidDateOnly, toDateOnly } from "./calendar";
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
// activo ya es el siguiente, el del día en que empieza. Es el que cambia
// "Desde este mes". El mes activo sigue el ciclo del presupuesto.
export function currentSeriesAmount(
  template: ExpenseTemplate,
  today: string,
  finance: FinanceStore,
): number {
  const { start } = activeBudgetMonth(finance, today);
  return templateAmountOn(template, start > today ? start : today);
}

// Si tiene sentido proponer un importe nuevo para los próximos cobros: la serie
// se repite y no ha terminado.
export function seriesHasUpcomingCharges(template: ExpenseTemplate, today: string) {
  return (
    template.recurrence.frequency !== "once" &&
    (!template.endDate || template.endDate >= today)
  );
}

export type SeriesAmountPrompt = {
  templateId: string;
  name: string;
  from: number;
  to: number;
};

// "¿Actualizar el importe desde ahora?" tras pagar con otro importe: solo si
// la serie sigue y lo pagado es distinto de lo que costarían los próximos
// cobros.
export function seriesAmountPromptFor(
  store: ExpenseStore,
  templateId: string,
  paidAmount: number,
  today: string,
): SeriesAmountPrompt | null {
  const template = store.templates.find((item) => item.id === templateId);
  if (!template || !seriesHasUpcomingCharges(template, today)) return null;
  const from = currentSeriesAmount(template, today, store.finance);
  return from === paidAmount ? null : { templateId, name: template.name, from, to: paidAmount };
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

// Un fin y una pausa señalan cobros, no días. Al cambiar el calendario de la
// serie (día de cobro, inicio o recurrencia), los cobros que señalaban pasan a
// la fecha de su mes en el calendario nuevo, como los overrides de los meses
// abiertos: "Finalizar tras ese cobro" sigue acabando en ese cobro y la pausa
// salta los mismos meses. Una fecha que ya encaja con el calendario nuevo se
// conserva. Si algún mes implicado no tiene un único cobro en los dos
// calendarios (una serie semanal, p. ej.), se quedan como estaban.
export function reanchorLifecycleForSchedule(
  previous: ExpenseTemplate,
  next: ExpenseTemplate,
): Pick<ExpenseTemplate, "endDate" | "pauses"> {
  const remap = chargeRemap(previous, next);
  const pauses = previous.pauses?.flatMap((pause) => reanchorPause(pause, remap));
  return {
    endDate: previous.endDate && reanchorEndDate(previous.endDate, remap),
    pauses: pauses?.length ? pauses : undefined,
  };
}

type ChargeRemap = {
  // Último cobro del calendario anterior antes de una fecha y primero desde ella.
  before: (date: string) => string | undefined;
  from: (date: string) => string | undefined;
  // El cobro de ese mes en el calendario nuevo, si cada calendario tiene uno.
  map: (charge: string) => string | null;
};

// Un cobro del calendario anterior y su fecha en el nuevo. undefined: no hay
// cobro (nada que respetar); null: no se puede llevar al calendario nuevo.
type Anchor = { charge: string; mapped: string } | undefined;

function chargeRemap(previous: ExpenseTemplate, next: ExpenseTemplate): ChargeRemap {
  const before = unboundedSchedule(previous);
  const after = unboundedSchedule(next);
  const chargesInMonth = (schedule: typeof before, date: string) =>
    generateTemplateDates(
      schedule,
      `${date.slice(0, 7)}-01`,
      toDateOnly(endOfMonth(parseISO(date))),
    );
  return {
    before: (date) =>
      generateTemplateDates(
        before,
        toDateOnly(subYears(parseISO(date), CHOICE_HORIZON_YEARS)),
        shiftDays(date, -1),
      ).at(-1),
    from: (date) =>
      generateTemplateDates(
        before,
        date,
        toDateOnly(addYears(parseISO(date), CHOICE_HORIZON_YEARS)),
      )[0],
    map: (charge) => {
      const old = chargesInMonth(before, charge);
      const mapped = chargesInMonth(after, charge);
      return old.length === 1 && mapped.length === 1 ? mapped[0] : null;
    },
  };
}

// El calendario sin pausas ni fin: los cobros que la serie programa.
function unboundedSchedule({
  startDate,
  dueDay,
  recurrence,
}: ExpenseTemplate): Pick<ExpenseTemplate, "startDate" | "dueDay" | "recurrence"> {
  return { startDate, dueDay, recurrence };
}

function anchorOf(charge: string | undefined, remap: ChargeRemap): Anchor | null {
  if (!charge) return undefined;
  const mapped = remap.map(charge);
  return mapped ? { charge, mapped } : null;
}

function shiftDays(date: string, days: number) {
  return toDateOnly(addDays(parseISO(date), days));
}

// El fin sigue tras el mismo último cobro y antes del siguiente.
function reanchorEndDate(endDate: string, remap: ChargeRemap): string {
  if (!isValidDateOnly(endDate)) return endDate;
  const last = anchorOf(remap.before(shiftDays(endDate, 1)), remap);
  const following = anchorOf(remap.from(shiftDays(endDate, 1)), remap);
  if (!last || following === null) return endDate;
  const fits = last.mapped <= endDate && (!following || endDate < following.mapped);
  return endDate === last.charge || !fits ? last.mapped : endDate;
}

// La pausa sigue saltando los mismos cobros y ninguno más. Una pausa que no
// saltaba ninguno se encoge para no saltar ninguno (o desaparece).
function reanchorPause(pause: ExpensePause, remap: ChargeRemap): ExpensePause[] {
  if (!isValidDateOnly(pause.from) || (pause.to && !isValidDateOnly(pause.to))) {
    return [pause];
  }
  const previous = anchorOf(remap.before(pause.from), remap);
  const first = anchorOf(remap.from(pause.from), remap);
  if (previous === null || first === null) return [pause];

  if (!first || (pause.to && first.charge > pause.to)) {
    if (!pause.to) return [pause];
    const from =
      previous && pause.from <= previous.mapped ? shiftDays(previous.mapped, 1) : pause.from;
    const to = first && pause.to >= first.mapped ? shiftDays(first.mapped, -1) : pause.to;
    return from <= to ? [{ from, to }] : [];
  }

  const fromFits =
    (!previous || pause.from > previous.mapped) && pause.from <= first.mapped;
  const from = pause.from === first.charge || !fromFits ? first.mapped : pause.from;
  if (!pause.to) return [{ from }];

  const last = anchorOf(remap.before(shiftDays(pause.to, 1)), remap);
  const resume = anchorOf(remap.from(shiftDays(pause.to, 1)), remap);
  if (!last || resume === null) return [pause];
  const toFits = last.mapped <= pause.to && (!resume || pause.to < resume.mapped);
  // Una pausa "hasta el cobro con el que vuelve" sigue acabando el día antes.
  const untilResume = resume && pause.to === shiftDays(resume.charge, -1);
  const to =
    resume && (untilResume || !toFits)
      ? shiftDays(resume.mapped, -1)
      : toFits
        ? pause.to
        : last.mapped;
  return [{ from, to }];
}
