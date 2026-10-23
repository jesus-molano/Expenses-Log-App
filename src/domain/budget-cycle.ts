import { addDays, parseISO } from "date-fns";
import { buildDateWithDay, toDateOnly } from "./calendar";
import { getMonthlySalarySettings } from "./finance";
import type { FinanceStore } from "./types";

// Qué días forman cada mes de presupuesto. Por defecto es el mes natural; con
// el ciclo anclado al cobro, cada mes empieza el día de cobro.
//
// Los meses de presupuesto conservan su id YYYY-MM (sueldo, ahorro y cierres
// siguen indexados igual). El ciclo lleva el nombre del mes en el que cae la
// mayor parte de sus días:
// - cobro el 28: "noviembre" va del 28 de octubre al 27 de noviembre;
// - cobro el 5: "noviembre" va del 5 de noviembre al 4 de diciembre.
// Así cada inicio cae entre el día 16 del mes anterior y el 15 del propio, y
// los ciclos se encadenan sin huecos ni solapes aunque cambie el día de cobro.
export const LATE_PAYDAY_FROM = 16;

export type BudgetCycle =
  | { anchor: "calendar" }
  | { anchor: "payday"; monthlySalary: FinanceStore["monthlySalary"] };

export const CALENDAR_CYCLE: BudgetCycle = { anchor: "calendar" };

export type DateRange = { start: string; end: string };

export function addMonthId(monthId: string, delta: number): string {
  const [year, month] = monthId.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Día de cobro solo si el sueldo está configurado: sin él, "ya cobraste" no
// significa nada.
export function configuredPayday(
  finance: Pick<FinanceStore, "monthlySalary">,
  monthId: string,
) {
  const hasSalary = Object.keys(finance.monthlySalary).some(
    (salaryMonthId) => salaryMonthId <= monthId,
  );
  const salary = getMonthlySalarySettings(finance, monthId);
  return hasSalary && salary.amount > 0 ? salary.dayOfMonth : null;
}

export function resolveBudgetCycle(finance: FinanceStore): BudgetCycle {
  return finance.budgetCycle?.anchor === "payday"
    ? { anchor: "payday", monthlySalary: finance.monthlySalary }
    : CALENDAR_CYCLE;
}

// Día de cobro que abre el mes de presupuesto `monthId`, o null si ese mes es
// natural (ciclo natural, o anclado al cobro sin sueldo configurado aún).
export function cyclePayday(cycle: BudgetCycle, monthId: string): number | null {
  return cycle.anchor === "payday" ? configuredPayday(cycle, monthId) : null;
}

// Se consulta por cada recibo al repartirlos por meses: se recuerda por ciclo
// (el objeto se crea una vez por versión del store).
const periodStartCache = new WeakMap<BudgetCycle, Map<string, string>>();

export function periodStart(monthId: string, cycle: BudgetCycle = CALENDAR_CYCLE) {
  if (cycle.anchor === "calendar") return `${monthId}-01`;

  const cache = periodStartCache.get(cycle) ?? new Map<string, string>();
  periodStartCache.set(cycle, cache);
  const cached = cache.get(monthId);
  if (cached) return cached;

  const start = paydayPeriodStart(monthId, cyclePayday(cycle, monthId));
  cache.set(monthId, start);
  return start;
}

function paydayPeriodStart(monthId: string, payday: number | null) {
  if (payday === null) return `${monthId}-01`;
  const anchorMonthId = payday >= LATE_PAYDAY_FROM ? addMonthId(monthId, -1) : monthId;
  // Un cobro el 30 o el 31 cae el último día en los meses más cortos.
  return toDateOnly(buildDateWithDay(parseISO(`${anchorMonthId}-01`), payday));
}

// Del inicio de este mes de presupuesto al día anterior al inicio del
// siguiente.
export function periodRange(
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): DateRange {
  const nextStart = periodStart(addMonthId(monthId, 1), cycle);
  return {
    start: periodStart(monthId, cycle),
    end: toDateOnly(addDays(parseISO(nextStart), -1)),
  };
}

// Mes de presupuesto al que pertenece una fecha YYYY-MM-DD.
export function periodIdOf(date: string, cycle: BudgetCycle = CALENDAR_CYCLE) {
  const monthId = date.slice(0, 7);
  if (cycle.anchor === "calendar") return monthId;

  const nextMonthId = addMonthId(monthId, 1);
  if (date >= periodStart(nextMonthId, cycle)) return nextMonthId;
  if (date < periodStart(monthId, cycle)) return addMonthId(monthId, -1);
  return monthId;
}

export function isInRange(date: string, range: DateRange) {
  return date >= range.start && date <= range.end;
}
