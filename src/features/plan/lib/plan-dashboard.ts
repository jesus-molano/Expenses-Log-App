import { endOfMonth, format, startOfMonth } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  occurrencesDueBetween,
  toMonthId,
} from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";

export function occurrencesForMonth(
  store: ExpenseStore,
  monthDate: Date,
  language: AppLanguage,
) {
  return occurrencesDueBetween(
    store,
    toDateOnly(startOfMonth(monthDate)),
    toDateOnly(endOfMonth(monthDate)),
    language,
  );
}

export function buildSeriesItem(
  store: ExpenseStore,
  monthDate: Date,
  today: Date,
  language: AppLanguage,
): MoneySeriesItem {
  const locale = language === "en" ? enUS : es;
  const monthId = toDateOnly(startOfMonth(monthDate));
  const plan = buildMonthlyMoneyPlan({
    monthDate,
    finance: store.finance,
    occurrences: occurrencesForMonth(store, monthDate, language),
    today,
    includeExtraIncome: toMonthId(monthDate) <= toMonthId(today),
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

export function getAvailableYears(store: ExpenseStore, today: Date) {
  const years = new Set<number>([today.getFullYear()]);
  store.templates.forEach((template) => years.add(Number(template.startDate.slice(0, 4))));
  store.finance.incomeEvents.forEach((event) => years.add(Number(event.receivedAt.slice(0, 4))));
  (store.occurrenceRecords ?? []).forEach((record) => years.add(Number(record.dueDate.slice(0, 4))));
  return Array.from(years).filter(Number.isFinite).sort((a, b) => b - a);
}

export function formatShortDate(date: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export function phaseLabel(
  phase: MoneySeriesItem["phase"],
  language: AppLanguage,
) {
  if (phase === "projected") return t("plan.projected", language);
  if (phase === "current") return t("plan.current", language);
  return t("plan.registered", language);
}
