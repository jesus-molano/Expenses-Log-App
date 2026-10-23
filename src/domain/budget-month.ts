import { endOfMonth, parseISO } from "date-fns";
import { daysBetween, toDateOnly } from "./calendar";
import {
  getExpectedSalary,
  getMonthlySalarySettings,
  getSalaryExtraPay,
  getSalaryReceipt,
  occurrencesDueBetween,
} from "./finance";
import { isOccurrenceOverdue, monthPendingSummary } from "./pending";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseStore,
  FinanceStore,
  MonthClosure,
} from "./types";

export { monthPendingSummary, type MonthPendingSummary } from "./pending";

// Días antes de fin de mes en los que se ofrece pasar al siguiente aunque no
// haya llegado el cobro.
export const ADVANCE_SUGGESTION_DAYS = 10;

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

export type SalaryPrompt = {
  monthId: string;
  payday: number;
  // Sueldo previsto, con la paga extra si toca (que también va aparte).
  expectedAmount: number;
  extraPayAmount: number;
};

// "¿Has cobrado?": desde el día de cobro del mes natural (el último día si el
// mes es más corto) hasta que se responda, y solo con el sueldo configurado.
export function salaryPromptFor(
  finance: FinanceStore,
  today: string,
): SalaryPrompt | null {
  const monthId = today.slice(0, 7);
  const payday = configuredPayday(finance, monthId);
  if (payday === null || getSalaryReceipt(finance, monthId)) return null;
  const lastDay = Number(monthRange(monthId).end.slice(8, 10));
  if (Number(today.slice(8, 10)) < Math.min(payday, lastDay)) return null;
  return {
    monthId,
    payday,
    expectedAmount: getExpectedSalary(finance, monthId),
    extraPayAmount: getSalaryExtraPay(finance, monthId),
  };
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
  const paydayReached = payday !== null && Number(today.slice(8, 10)) >= payday;
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
