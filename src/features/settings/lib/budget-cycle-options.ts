import {
  configuredPayday,
  periodIdOf,
  periodRange,
  resolveBudgetCycle,
} from "@/domain/budget-cycle";
import type {
  AppLanguage,
  BudgetCycleAnchor,
  FinanceStore,
} from "@/domain/types";
import {
  capitalize,
  formatMonthName,
  formatPeriodRange,
} from "@/features/expenses/lib/month-view";
import { t } from "@/shared/i18n";

export type BudgetCycleOption = {
  value: BudgetCycleAnchor;
  label: string;
  description: string;
};

// Lo que muestra la fila "Mes del presupuesto": la opción elegida, el mes en
// curso con sus días cuando empieza el día de cobro, y las dos opciones.
export function describeBudgetCycle(
  finance: FinanceStore,
  today: string,
  language: AppLanguage,
) {
  const anchor: BudgetCycleAnchor = finance.budgetCycle?.anchor ?? "calendar";
  const payday = configuredPayday(finance, today.slice(0, 7));
  const calendarDetail = t("insights.cycle.calendarDetail", language);
  const paydayDetail =
    payday === null
      ? t("insights.cycle.paydayMissing", language)
      : payday === 1
        ? calendarDetail
        : t("insights.cycle.paydayDetail", language)
            .replace("{start}", String(payday))
            .replace("{end}", String(payday - 1));

  const options: BudgetCycleOption[] = [
    {
      value: "calendar",
      label: t("insights.cycle.calendar", language),
      description: calendarDetail,
    },
    {
      value: "payday",
      label: t("insights.cycle.payday", language),
      description: paydayDetail,
    },
  ];

  return {
    anchor,
    payday,
    shortLabel:
      anchor === "payday"
        ? t("insights.cycle.paydayShort", language)
        : t("insights.cycle.calendarShort", language),
    summary:
      anchor === "payday" && payday !== null
        ? currentPeriodSummary(finance, today, language)
        : anchor === "payday"
          ? paydayDetail
          : t("insights.cycle.calendar", language),
    options,
  };
}

function currentPeriodSummary(
  finance: FinanceStore,
  today: string,
  language: AppLanguage,
) {
  const cycle = resolveBudgetCycle(finance);
  const monthId = periodIdOf(today, cycle);
  return t("insights.cycle.current", language)
    .replace("{month}", capitalize(formatMonthName(monthId, language)))
    .replace("{range}", formatPeriodRange(periodRange(monthId, cycle), language));
}
