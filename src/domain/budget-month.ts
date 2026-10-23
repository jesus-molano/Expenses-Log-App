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
import { daysBetween, toDateOnly } from "./calendar";
import { occurrencesDueBetween } from "./finance";
import { isOccurrenceOverdue, monthPendingSummary } from "./pending";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseStore,
  MonthClosure,
} from "./types";

export { monthPendingSummary, type MonthPendingSummary } from "./pending";
export { addMonthId, configuredPayday } from "./budget-cycle";

// Días antes de fin de mes en los que se ofrece pasar al siguiente aunque no
// haya llegado el cobro.
export const ADVANCE_SUGGESTION_DAYS = 10;

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
  // Recibos del mes siguiente que ya están pagados.
  nextMonthPaidCount: number;
};

export function monthCloseStatus(
  occurrences: ExpenseOccurrence[],
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): MonthCloseStatus {
  const nextMonthId = addMonthId(monthId, 1);
  const pending = monthPendingSummary(
    occurrences,
    monthId,
    periodRange(monthId, cycle),
  );
  const paidIn = (id: string) =>
    occurrences.filter(
      (occurrence) =>
        occurrence.status === "paid" &&
        periodIdOf(occurrence.dueDate, cycle) === id,
    ).length;

  return {
    monthId,
    paidCount: paidIn(monthId),
    pendingCount: pending.count,
    pendingTotal: pending.total,
    nextMonthPaidCount: paidIn(nextMonthId),
  };
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
  const paydayReached =
    payday !== null &&
    cyclePayday(cycle, status.monthId) === null &&
    Number(today.slice(8, 10)) >= payday;
  return daysLeft <= ADVANCE_SUGGESTION_DAYS || paydayReached;
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
