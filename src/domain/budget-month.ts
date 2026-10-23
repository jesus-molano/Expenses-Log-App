import { endOfMonth, parseISO } from "date-fns";
import { buildDateWithDay, daysBetween, toDateOnly } from "./calendar";
import {
  buildMonthlyMoneyPlan,
  getMonthlySalarySettings,
  occurrencesDueBetween,
} from "./finance";
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

// Días antes de fin de mes en los que se ofrece pasar al siguiente aunque no
// haya llegado el cobro.
export const ADVANCE_SUGGESTION_DAYS = 10;

// Últimos días del mes en los que, sin haber cobrado, se ofrece cerrarlo
// aunque queden recibos por resolver.
export const LEFTOVERS_SUGGESTION_DAYS = 3;

export function addMonthId(monthId: string, delta: number): string {
  const [year, month] = monthId.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

// El mes natural, o el siguiente si el natural está cerrado; nunca más de uno
// por delante. El cierre deja de importar cuando el calendario alcanza al mes
// activo.
export function resolveActiveMonth(
  today: string,
  closures: Record<string, MonthClosure> | undefined,
) {
  const calendarMonthId = today.slice(0, 7);
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
  // Lo que queda pendiente del mes, para resolverlo al cerrarlo.
  leftovers: ExpenseOccurrence[];
};

export function monthCloseStatus(
  occurrences: ExpenseOccurrence[],
  monthId: string,
): MonthCloseStatus {
  const nextMonthId = addMonthId(monthId, 1);
  const pending = monthPendingSummary(occurrences, monthId);
  const paidIn = (id: string) =>
    occurrences.filter(
      (occurrence) =>
        occurrence.status === "paid" && occurrence.dueDate.slice(0, 7) === id,
    ).length;

  return {
    monthId,
    paidCount: paidIn(monthId),
    pendingCount: pending.count,
    pendingTotal: pending.total,
    nextMonthPaidCount: paidIn(nextMonthId),
    leftovers: pending.items,
  };
}

// Día de cobro solo si el sueldo está configurado: sin él, "ya cobraste" no
// significa nada.
export function configuredPayday(finance: FinanceStore, monthId: string) {
  const hasSalary = Object.keys(finance.monthlySalary).some(
    (salaryMonthId) => salaryMonthId <= monthId,
  );
  const salary = getMonthlySalarySettings(finance, monthId);
  return hasSalary && salary.amount > 0 ? salary.dayOfMonth : null;
}

// Día de cobro de un mes, acotado a su último día (un 31 cae el 30 en
// noviembre).
function paydayDate(monthId: string, payday: number) {
  return toDateOnly(buildDateWithDay(parseISO(`${monthId}-01`), payday));
}

function isPaydayReached(today: string, payday: number | null) {
  return payday !== null && today >= paydayDate(today.slice(0, 7), payday);
}

// Se ofrece pasar de mes cuando el mes natural tiene recibos, ninguno
// pendiente, y queda poco para fin de mes o ya llegó el cobro.
export function shouldSuggestAdvance({
  status,
  today,
  payday,
}: {
  status: MonthCloseStatus;
  today: string;
  payday: number | null;
}) {
  if (status.monthId !== today.slice(0, 7)) return false;
  if (status.paidCount === 0 || status.pendingCount > 0) return false;

  const daysLeft = daysBetween(today, monthRange(status.monthId).end);
  return daysLeft <= ADVANCE_SUGGESTION_DAYS || isPaydayReached(today, payday);
}

// Si tras el cobro quedan recibos del mes, se ofrece cerrarlo resolviendo lo
// que queda. El cobro solo cuenta en los últimos días del mes (quien cobra a
// primeros financia ese mes, no el siguiente); sin cobro, se ofrece en los
// últimos días.
export function shouldSuggestCloseWithLeftovers({
  status,
  today,
  payday,
}: {
  status: MonthCloseStatus;
  today: string;
  payday: number | null;
}) {
  if (status.monthId !== today.slice(0, 7)) return false;
  if (status.pendingCount === 0) return false;

  const daysLeft = daysBetween(today, monthRange(status.monthId).end);
  return (
    daysLeft < LEFTOVERS_SUGGESTION_DAYS ||
    (daysLeft <= ADVANCE_SUGGESTION_DAYS && isPaydayReached(today, payday))
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
// no cuenta.
export function buildPaydayOutlook(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): PaydayOutlook | null {
  const payday = getNextPayday(store.finance, today);
  if (!payday) return null;

  const seenIds = new Set<string>();
  const items = [
    ...selectCarryOverOccurrences(store, parseISO(today), language),
    ...occurrencesDueBetween(store, monthRange(today.slice(0, 7)).start, payday, language),
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
// el día 1 si aún no ha empezado y el último día si ya terminó.
export function defaultDateInMonth(monthId: string, today: string) {
  const { start, end } = monthRange(monthId);
  if (today < start) return start;
  if (today > end) return end;
  return today;
}

// Plan de un mes con la misma atribución que Gastos (cada cobro en el mes de
// su dueDate) y la fase respecto al mes activo.
export function buildMonthPlan(
  store: ExpenseStore,
  monthId: string,
  {
    today,
    activeMonthId = resolveActiveMonth(today, store.finance.monthClosures),
    language = "es",
  }: { today: string; activeMonthId?: string; language?: AppLanguage },
): MonthlyMoneyPlan {
  const { start, end } = monthRange(monthId);
  return buildMonthlyMoneyPlan({
    monthDate: parseISO(start),
    finance: store.finance,
    occurrences: occurrencesDueBetween(store, start, end, language),
    today: parseISO(today),
    activeMonthId,
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
): ExpenseOccurrence[] {
  const previousMonth = monthRange(addMonthId(monthId, -1));
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
  calendarMonthId: string;
  activeMonthId: string;
  nextMonthId: string;
  closeStatus: MonthCloseStatus;
  payday: number | null;
};

// Todo lo que la vista del mes necesita saber de hoy y del store.
export function buildMonthContext(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): MonthContext {
  const calendarMonthId = today.slice(0, 7);
  const nextMonthId = addMonthId(calendarMonthId, 1);
  return {
    today,
    calendarMonthId,
    activeMonthId: resolveActiveMonth(today, store.finance.monthClosures),
    nextMonthId,
    closeStatus: monthCloseStatus(
      occurrencesDueBetween(
        store,
        monthRange(calendarMonthId).start,
        monthRange(nextMonthId).end,
        language,
      ),
      calendarMonthId,
    ),
    payday: configuredPayday(store.finance, calendarMonthId),
  };
}

// Si pagar este recibo deja al día el mes natural y toca proponer el cambio.
export function paymentSettlesMonth(
  context: MonthContext,
  occurrence: ExpenseOccurrence,
) {
  const { closeStatus, calendarMonthId } = context;
  return (
    occurrence.status === "due" &&
    occurrence.dueDate.slice(0, 7) === calendarMonthId &&
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
    })
  );
}
