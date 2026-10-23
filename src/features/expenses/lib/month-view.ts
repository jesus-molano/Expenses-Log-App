import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { addMonthId } from "@/domain/budget-month";
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
