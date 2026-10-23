import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { addMonthId } from "@/domain/budget-month";
import {
  periodRange,
  type BudgetCycle,
  type DateRange,
} from "@/domain/budget-cycle";
import type { AppLanguage } from "@/domain/types";

// Meses que se pueden mirar desde el mes activo: un año hacia atrás y el
// siguiente para planificar.
export const VIEW_MONTHS_BACK = 12;
export const VIEW_MONTHS_AHEAD = 1;

export function viewMonthBounds(activeMonthId: string) {
  return {
    min: addMonthId(activeMonthId, -VIEW_MONTHS_BACK),
    max: addMonthId(activeMonthId, VIEW_MONTHS_AHEAD),
  };
}

export function clampViewMonth(monthId: string, activeMonthId: string) {
  const { min, max } = viewMonthBounds(activeMonthId);
  if (monthId < min) return min;
  if (monthId > max) return max;
  return monthId;
}

export function formatMonthName(
  monthId: string,
  language: AppLanguage,
  { withYear = false }: { withYear?: boolean } = {},
) {
  return format(parseISO(`${monthId}-01`), withYear ? "LLLL yyyy" : "LLLL", {
    locale: language === "en" ? enUS : es,
  });
}

export function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

// "28 oct – 27 nov": los días de un mes de presupuesto que no es el natural.
export function formatPeriodRange(range: DateRange, language: AppLanguage) {
  const locale = language === "en" ? enUS : es;
  const day = (date: string) => format(parseISO(date), "d MMM", { locale });
  return `${day(range.start)} – ${day(range.end)}`;
}

// Primer día en que se puede soltar un gasto al arrastrar con el ciclo
// anclado al cobro: ni antes del mes que se mira, ni antes del ciclo en curso,
// ni en un mes natural ya cerrado (sus cobros quedan en el historial).
export function cycleDropFloorDate({
  viewMonthId,
  calendarMonthId,
  today,
  cycle,
}: {
  viewMonthId: string;
  calendarMonthId: string;
  today: string;
  cycle: BudgetCycle;
}) {
  return [
    periodRange(viewMonthId, cycle).start,
    periodRange(calendarMonthId, cycle).start,
    `${today.slice(0, 7)}-01`,
  ].sort()[2];
}
