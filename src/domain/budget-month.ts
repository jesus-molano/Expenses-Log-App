import { endOfMonth, parseISO } from "date-fns";
import {
  addMonthId,
  CALENDAR_CYCLE,
  configuredPayday,
  cyclePayday,
  periodIdOf,
  periodRange,
  resolveBudgetCycle,
  type BudgetCycle,
} from "./budget-cycle";
import { buildDateWithDay, daysBetween, toDateOnly } from "./calendar";
import { buildMonthlyMoneyPlan, occurrencesDueBetween } from "./finance";
import { isOccurrenceOverdue, monthPendingSummary } from "./pending";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseStore,
  FinanceStore,
  MonthClosure,
  MonthlyMoneyPlan,
} from "./types";

export { monthPendingSummary, type MonthPendingSummary } from "./pending";
export { addMonthId, configuredPayday } from "./budget-cycle";

// Días antes de fin de mes en los que se ofrece pasar al siguiente aunque no
// haya llegado el cobro.
export const ADVANCE_SUGGESTION_DAYS = 10;

// Últimos días del mes en los que, sin haber cobrado, se ofrece cerrarlo
// aunque queden recibos por resolver.
export const LEFTOVERS_SUGGESTION_DAYS = 3;

export function monthRange(monthId: string) {
  const start = `${monthId}-01`;
  return { start, end: toDateOnly(endOfMonth(parseISO(start))) };
}

export function isMonthClosed(
  closures: Record<string, MonthClosure> | undefined,
  monthId: string,
) {
  const closure = closures?.[monthId];
  return Boolean(
    closure && (!closure.reopenedAt || closure.reopenedAt < closure.closedAt),
  );
}

// El mes natural (el de presupuesto en que cae hoy), o el siguiente si el
// natural está cerrado; nunca más de uno por delante. El cierre deja de
// importar cuando el calendario alcanza al mes activo.
export function resolveActiveMonth(
  today: string,
  closures: Record<string, MonthClosure> | undefined,
  cycle: BudgetCycle = CALENDAR_CYCLE,
) {
  const calendarMonthId = periodIdOf(today, cycle);
  return isMonthClosed(closures, calendarMonthId)
    ? addMonthId(calendarMonthId, 1)
    : calendarMonthId;
}

export type MonthCloseStatus = {
  monthId: string;
  paidCount: number;
  pendingCount: number;
  pendingTotal: number;
  // Lo que queda pendiente del mes, para resolverlo al cerrarlo.
  leftovers: ExpenseOccurrence[];
};

export function monthCloseStatus(
  occurrences: ExpenseOccurrence[],
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): MonthCloseStatus {
  const pending = monthPendingSummary(
    occurrences,
    monthId,
    periodRange(monthId, cycle),
  );
  const paidCount = occurrences.filter(
    (occurrence) =>
      occurrence.status === "paid" &&
      periodIdOf(occurrence.dueDate, cycle) === monthId,
  ).length;

  return {
    monthId,
    paidCount,
    pendingCount: pending.count,
    pendingTotal: pending.total,
    leftovers: pending.items,
  };
}

// Día de cobro de un mes, acotado a su último día (un 31 cae el 30 en
// noviembre).
function paydayDate(monthId: string, payday: number) {
  return toDateOnly(buildDateWithDay(parseISO(`${monthId}-01`), payday));
}

function isPaydayReached(today: string, payday: number | null) {
  return payday !== null && today >= paydayDate(today.slice(0, 7), payday);
}

// Con el ciclo anclado al cobro, el cobro abre el mes siguiente: no adelanta
// el cambio de un mes que ya termina el día antes del cobro.
function paydayCountsForMonth(
  cycle: BudgetCycle,
  monthId: string,
  today: string,
  payday: number | null,
) {
  return cyclePayday(cycle, monthId) === null && isPaydayReached(today, payday);
}

// Se ofrece pasar de mes cuando el mes natural tiene recibos, ninguno
// pendiente, y queda poco para fin de mes o ya llegó el cobro. Con el ciclo
// anclado al cobro, el cobro abre el mes siguiente: solo cuentan los días.
export function shouldSuggestAdvance({
  status,
  today,
  payday,
  cycle = CALENDAR_CYCLE,
}: {
  status: MonthCloseStatus;
  today: string;
  payday: number | null;
  cycle?: BudgetCycle;
}) {
  if (status.monthId !== periodIdOf(today, cycle)) return false;
  if (status.paidCount === 0 || status.pendingCount > 0) return false;

  const daysLeft = daysBetween(today, periodRange(status.monthId, cycle).end);
  return (
    daysLeft <= ADVANCE_SUGGESTION_DAYS ||
    paydayCountsForMonth(cycle, status.monthId, today, payday)
  );
}

// Si tras el cobro quedan recibos del mes, se ofrece cerrarlo resolviendo lo
// que queda. El cobro solo cuenta en los últimos días del mes (quien cobra a
// primeros financia ese mes, no el siguiente); sin cobro, se ofrece en los
// últimos días. Con el ciclo anclado al cobro solo cuentan los días.
export function shouldSuggestCloseWithLeftovers({
  status,
  today,
  payday,
  cycle = CALENDAR_CYCLE,
}: {
  status: MonthCloseStatus;
  today: string;
  payday: number | null;
  cycle?: BudgetCycle;
}) {
  if (status.monthId !== periodIdOf(today, cycle)) return false;
  if (status.pendingCount === 0) return false;

  const daysLeft = daysBetween(today, periodRange(status.monthId, cycle).end);
  return (
    daysLeft < LEFTOVERS_SUGGESTION_DAYS ||
    (daysLeft <= ADVANCE_SUGGESTION_DAYS &&
      paydayCountsForMonth(cycle, status.monthId, today, payday))
  );
}

// Próximo cobro después de hoy, con el sueldo configurado del mes en que cae.
export function getNextPayday(finance: FinanceStore, today: string): string | null {
  const monthId = today.slice(0, 7);
  const day = configuredPayday(finance, monthId);
  if (day !== null) {
    const thisMonth = paydayDate(monthId, day);
    if (thisMonth > today) return thisMonth;
  }

  const nextMonthId = addMonthId(monthId, 1);
  const nextDay = configuredPayday(finance, nextMonthId);
  return nextDay === null ? null : paydayDate(nextMonthId, nextDay);
}

export type PaydayOutlook = {
  payday: string;
  daysUntil: number;
  total: number;
  items: ExpenseOccurrence[];
};

// "Hasta el cobro": lo que falta por pagar y se carga antes del próximo
// sueldo, atrasos incluidos. Lo ya pagado (también lo pagado por adelantado)
// no cuenta. Los atrasos y el inicio se miden en el mes de presupuesto en que
// cae hoy (el natural o el ciclo desde el día de cobro).
export function buildPaydayOutlook(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): PaydayOutlook | null {
  const payday = getNextPayday(store.finance, today);
  if (!payday) return null;

  const cycle = resolveBudgetCycle(store.finance);
  const monthId = periodIdOf(today, cycle);
  const seenIds = new Set<string>();
  const items = [
    ...selectCarryOverOccurrences(store, parseISO(today), language, monthId, cycle),
    ...occurrencesDueBetween(store, periodRange(monthId, cycle).start, payday, language),
  ].filter((occurrence) => {
    if (
      occurrence.status !== "due" ||
      occurrence.estimatedChargeDate >= payday ||
      seenIds.has(occurrence.id)
    ) {
      return false;
    }
    seenIds.add(occurrence.id);
    return true;
  });

  return {
    payday,
    daysUntil: daysBetween(today, payday),
    total: items.reduce((sum, occurrence) => sum + occurrence.template.amount, 0),
    items,
  };
}

// Día en que se apunta algo de un mes (un ingreso extra): hoy si es ese mes,
// su primer día si aún no ha empezado y el último si ya terminó. `cycle` dice
// qué días forman el mes (el natural o desde el día de cobro).
export function defaultDateInMonth(
  monthId: string,
  today: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
) {
  const { start, end } = periodRange(monthId, cycle);
  if (today < start) return start;
  if (today > end) return end;
  return today;
}

// Plan de un mes con la misma atribución que Gastos (cada cobro en el mes de
// presupuesto de su dueDate) y la fase respecto al mes activo.
export function buildMonthPlan(
  store: ExpenseStore,
  monthId: string,
  {
    today,
    cycle = resolveBudgetCycle(store.finance),
    activeMonthId = resolveActiveMonth(today, store.finance.monthClosures, cycle),
    language = "es",
  }: {
    today: string;
    cycle?: BudgetCycle;
    activeMonthId?: string;
    language?: AppLanguage;
  },
): MonthlyMoneyPlan {
  const range = periodRange(monthId, cycle);
  return buildMonthlyMoneyPlan({
    monthDate: parseISO(`${monthId}-01`),
    finance: store.finance,
    occurrences: occurrencesDueBetween(store, range.start, range.end, language),
    today: parseISO(today),
    activeMonthId,
    range,
  });
}

// Lo que quedó pendiente el mes anterior al que se mira (por defecto, el de
// hoy), para que no desaparezca el día 1. Lo pagado hoy se mantiene visible
// para poder deshacerlo desde la misma fila. Los gastos borrados conservan su
// historial, pero no vuelven a reclamar pago.
export function selectCarryOverOccurrences(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage = "es",
  monthId: string = toDateOnly(today).slice(0, 7),
  cycle: BudgetCycle = CALENDAR_CYCLE,
): ExpenseOccurrence[] {
  const previousMonth = periodRange(addMonthId(monthId, -1), cycle);
  const todayId = toDateOnly(today);
  const templateIds = new Set(store.templates.map((template) => template.id));

  return occurrencesDueBetween(
    store,
    previousMonth.start,
    previousMonth.end,
    language,
  ).filter(
    (occurrence) =>
      templateIds.has(occurrence.template.id) &&
      // Al mirar un mes futuro, lo del mes anterior que aún no ha vencido no
      // es un resto: sigue en su mes.
      ((occurrence.status === "due" &&
        (previousMonth.end < todayId || isOccurrenceOverdue(occurrence, todayId))) ||
        (occurrence.status === "paid" && paidOn(occurrence) === todayId)),
  );
}

function paidOn(occurrence: ExpenseOccurrence) {
  const paidAt = occurrence.override?.paidAt ?? occurrence.record?.paidAt;
  if (!paidAt) return null;
  const date = new Date(paidAt);
  return Number.isNaN(date.getTime()) ? null : toDateOnly(date);
}

export type MonthContext = {
  today: string;
  // Mes de presupuesto en que cae hoy: el natural o, con el ciclo anclado al
  // cobro, el ciclo en curso.
  calendarMonthId: string;
  activeMonthId: string;
  nextMonthId: string;
  closeStatus: MonthCloseStatus;
  payday: number | null;
  cycle: BudgetCycle;
};

// Todo lo que la vista del mes necesita saber de hoy y del store.
export function buildMonthContext(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): MonthContext {
  const cycle = resolveBudgetCycle(store.finance);
  const calendarMonthId = periodIdOf(today, cycle);
  const nextMonthId = addMonthId(calendarMonthId, 1);
  return {
    today,
    calendarMonthId,
    activeMonthId: resolveActiveMonth(today, store.finance.monthClosures, cycle),
    nextMonthId,
    closeStatus: monthCloseStatus(
      occurrencesDueBetween(
        store,
        periodRange(calendarMonthId, cycle).start,
        periodRange(nextMonthId, cycle).end,
        language,
      ),
      calendarMonthId,
      cycle,
    ),
    payday: configuredPayday(store.finance, calendarMonthId),
    cycle,
  };
}

// Si pagar este recibo deja al día el mes natural y toca proponer el cambio.
export function paymentSettlesMonth(
  context: MonthContext,
  occurrence: ExpenseOccurrence,
) {
  const { closeStatus, calendarMonthId, cycle } = context;
  return (
    occurrence.status === "due" &&
    periodIdOf(occurrence.dueDate, cycle) === calendarMonthId &&
    closeStatus.pendingCount === 1 &&
    shouldSuggestAdvance({
      status: {
        ...closeStatus,
        pendingCount: 0,
        pendingTotal: 0,
        paidCount: closeStatus.paidCount + 1,
      },
      today: context.today,
      payday: context.payday,
      cycle,
    })
  );
}
