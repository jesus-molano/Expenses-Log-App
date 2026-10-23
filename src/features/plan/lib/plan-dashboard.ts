import { format, startOfMonth } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  CALENDAR_CYCLE,
  isInRange,
  periodIdOf,
  periodRange,
  type BudgetCycle,
} from "@/domain/budget-cycle";
import { toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  occurrencesDueBetween,
  toMonthId,
} from "@/domain/finance";
import type {
  AppLanguage,
  ExpenseStore,
  FinanceStore,
  IncomeEvent,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";

// `cycle` decide qué días forman el mes: el natural o desde el día de cobro.
export function occurrencesForMonth(
  store: ExpenseStore,
  monthDate: Date,
  language: AppLanguage,
  cycle: BudgetCycle = CALENDAR_CYCLE,
) {
  const range = periodRange(toMonthId(monthDate), cycle);
  return occurrencesDueBetween(store, range.start, range.end, language);
}

// Plan de un mes de presupuesto con sus días y la fase respecto al mes activo
// (por defecto, el mes de presupuesto en que cae hoy).
export function buildPlanForMonth({
  store,
  monthDate,
  today,
  language,
  cycle = CALENDAR_CYCLE,
  activeMonthId = periodIdOf(toDateOnly(today), cycle),
  includeExtraIncome = true,
}: {
  store: ExpenseStore;
  monthDate: Date;
  today: Date;
  language: AppLanguage;
  cycle?: BudgetCycle;
  activeMonthId?: string;
  includeExtraIncome?: boolean;
}) {
  return buildMonthlyMoneyPlan({
    monthDate,
    finance: store.finance,
    occurrences: occurrencesForMonth(store, monthDate, language, cycle),
    today,
    activeMonthId,
    includeExtraIncome,
    range: periodRange(toMonthId(monthDate), cycle),
  });
}

export function incomeEventsInMonth(
  finance: FinanceStore,
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): IncomeEvent[] {
  const range = periodRange(monthId, cycle);
  return finance.incomeEvents.filter((event) =>
    isInRange(event.receivedAt.slice(0, 10), range),
  );
}

// `activeMonthId` es el mes activo; por defecto, el de presupuesto en que cae
// hoy según `cycle`.
export function buildSeriesItem(
  store: ExpenseStore,
  monthDate: Date,
  today: Date,
  language: AppLanguage,
  activeMonthId?: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): MoneySeriesItem {
  const locale = language === "en" ? enUS : es;
  const monthId = toDateOnly(startOfMonth(monthDate));
  const activeId = activeMonthId ?? periodIdOf(toDateOnly(today), cycle);
  const plan = buildPlanForMonth({
    store,
    monthDate,
    today,
    language,
    cycle,
    activeMonthId: activeId,
    // Los ingresos extra de meses posteriores al activo aún no han llegado.
    includeExtraIncome: toMonthId(monthDate) <= activeId,
  });

  return {
    id: monthId,
    month: format(monthDate, "MMM", { locale }),
    monthLong: format(monthDate, "MMMM yyyy", { locale }),
    income: plan.plannedIncomeTotal,
    expenses: plan.expectedExpensesTotal,
    remaining: plan.freeAccordingToPlan,
    savings: plan.savingsActual,
    shortfall: plan.billsShortfall,
    hasRecords: true,
    phase: plan.phase,
    plannedExpenses: plan.plannedExpensesTotal,
    paid: plan.paidExpensesTotal,
    pending: plan.pendingExpensesTotal,
    savingsGoal: plan.savingsTarget,
    capacity: plan.maxSavingsCapacity,
  };
}

// Años que se pueden elegir: los que tienen datos, el actual, el siguiente
// desde diciembre (para planificar enero) y los de los meses indicados (el
// activo y el que se mira).
export function getAvailableYears(
  store: ExpenseStore,
  today: Date,
  monthIds: string[] = [],
) {
  const years = new Set<number>([today.getFullYear()]);
  if (today.getMonth() === 11) years.add(today.getFullYear() + 1);
  monthIds.forEach((monthId) => years.add(Number(monthId.slice(0, 4))));
  store.templates.forEach((template) => years.add(Number(template.startDate.slice(0, 4))));
  store.finance.incomeEvents.forEach((event) => years.add(Number(event.receivedAt.slice(0, 4))));
  (store.occurrenceRecords ?? []).forEach((record) => years.add(Number(record.dueDate.slice(0, 4))));
  return Array.from(years).filter(Number.isFinite).sort((a, b) => b - a);
}

// "15 oct". Una fecha que no es YYYY-MM-DD se muestra tal cual en vez de
// romper la pantalla.
export function formatShortDate(date: string, language: AppLanguage) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
  }).format(value);
}

export function phaseLabel(
  phase: MoneySeriesItem["phase"],
  language: AppLanguage,
) {
  if (phase === "projected") return t("plan.projected", language);
  if (phase === "current") return t("plan.current", language);
  return t("plan.registered", language);
}
