import { parseISO } from "date-fns";
import {
  addMonthId,
  CALENDAR_CYCLE,
  periodRange,
  type BudgetCycle,
} from "@/domain/budget-cycle";
import { resolveActiveMonth } from "@/domain/budget-month";
import { daysBetween, toDateOnly } from "@/domain/calendar";
import { occurrenceAmount } from "@/domain/finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { buildPlanForMonth, occurrencesForMonth } from "./plan-dashboard";

export const MONTH_SUMMARY_CHANGES = 5;
// Días del principio del mes en que se ofrece el resumen del anterior, y del
// final en que se ofrece el del propio mes.
export const SUMMARY_AFTER_START_DAYS = 7;
export const SUMMARY_BEFORE_END_DAYS = 3;

export type MonthSummaryChangeKind = "new" | "gone" | "up" | "down";

export type MonthSummaryChange = {
  templateId: string;
  name: string;
  kind: MonthSummaryChangeKind;
  amount: number;
  previousAmount: number;
  delta: number;
};

export type MonthSummary = {
  monthId: string;
  previousMonthId: string;
  plannedTotal: number;
  plannedCount: number;
  paidTotal: number;
  paidCount: number;
  pendingTotal: number;
  pendingCount: number;
  skippedCount: number;
  incomeTotal: number;
  savingsActual: number;
  savingsTarget: number;
  freeAccordingToPlan: number;
  // Diferencia con el mes anterior.
  deltas: { planned: number; paid: number; savings: number };
  // Los recibos que más cambian frente al mes anterior.
  changes: MonthSummaryChange[];
};

// Resumen de un mes: lo previsto, lo pagado, lo que queda, lo ahorrado y qué
// recibos cambian más frente al mes anterior.
export function buildMonthSummary(
  store: ExpenseStore,
  monthId: string,
  {
    today,
    cycle = CALENDAR_CYCLE,
    language = "es",
  }: { today: Date; cycle?: BudgetCycle; language?: AppLanguage },
): MonthSummary {
  const previousMonthId = addMonthId(monthId, -1);
  // La fase (y con ella el ahorro reservado de un mes ya registrado) se mide
  // contra el mes activo, como en Plan: un mes cerrado ya es registrado.
  const activeMonthId = resolveActiveMonth(
    toDateOnly(today),
    store.finance.monthClosures,
    cycle,
  );
  const planFor = (id: string) =>
    buildPlanForMonth({
      store,
      monthDate: parseISO(`${id}-01`),
      today,
      language,
      cycle,
      activeMonthId,
    });
  const plan = planFor(monthId);
  const previous = planFor(previousMonthId);
  const occurrences = occurrencesForMonth(store, parseISO(`${monthId}-01`), language, cycle);
  const previousOccurrences = occurrencesForMonth(
    store,
    parseISO(`${previousMonthId}-01`),
    language,
    cycle,
  );

  return {
    monthId,
    previousMonthId,
    plannedTotal: plan.plannedExpensesTotal,
    plannedCount: plan.plannedExpenseCount,
    paidTotal: plan.paidExpensesTotal,
    paidCount: plan.paidExpenseCount,
    pendingTotal: plan.pendingExpensesTotal,
    pendingCount: plan.pendingExpenseCount,
    skippedCount: occurrences.filter((occurrence) => occurrence.status === "skipped").length,
    incomeTotal: plan.incomeTotal,
    savingsActual: plan.savingsActual,
    savingsTarget: plan.savingsTarget,
    freeAccordingToPlan: plan.freeAccordingToPlan,
    deltas: {
      planned: cents(plan.plannedExpensesTotal - previous.plannedExpensesTotal),
      paid: cents(plan.paidExpensesTotal - previous.paidExpensesTotal),
      savings: cents(plan.savingsActual - previous.savingsActual),
    },
    changes: biggestChanges(occurrences, previousOccurrences),
  };
}

// Por gasto, lo que costó este mes frente al anterior (lo quitado no cuenta).
export function biggestChanges(
  occurrences: ExpenseOccurrence[],
  previousOccurrences: ExpenseOccurrence[],
  limit = MONTH_SUMMARY_CHANGES,
): MonthSummaryChange[] {
  const current = totalsByTemplate(occurrences);
  const previous = totalsByTemplate(previousOccurrences);
  const templateIds = new Set([...current.keys(), ...previous.keys()]);

  return Array.from(templateIds)
    .flatMap((templateId): MonthSummaryChange[] => {
      const now = current.get(templateId);
      const before = previous.get(templateId);
      const amount = now?.amount ?? 0;
      const previousAmount = before?.amount ?? 0;
      const delta = cents(amount - previousAmount);
      if (delta === 0) return [];
      const kind: MonthSummaryChangeKind =
        previousAmount === 0 ? "new" : amount === 0 ? "gone" : delta > 0 ? "up" : "down";
      return [
        {
          templateId,
          name: now?.name ?? before?.name ?? templateId,
          kind,
          amount,
          previousAmount,
          delta,
        },
      ];
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function totalsByTemplate(occurrences: ExpenseOccurrence[]) {
  const totals = new Map<string, { name: string; amount: number }>();
  for (const occurrence of occurrences) {
    if (occurrence.status === "skipped") continue;
    const entry = totals.get(occurrence.template.id) ?? {
      name: occurrence.template.name,
      amount: 0,
    };
    entry.amount = cents(entry.amount + occurrenceAmount(occurrence));
    totals.set(occurrence.template.id, entry);
  }
  return totals;
}

// Qué resumen ofrecer en Plan: el del mes que se acaba de cerrar, el del mes
// anterior durante la primera semana o el del propio mes en sus últimos días.
export function summaryPromptMonth({
  today,
  calendarMonthId,
  activeMonthId,
  cycle = CALENDAR_CYCLE,
}: {
  today: string;
  calendarMonthId: string;
  activeMonthId: string;
  cycle?: BudgetCycle;
}): string | null {
  if (activeMonthId > calendarMonthId) return calendarMonthId;
  const range = periodRange(calendarMonthId, cycle);
  if (daysBetween(today, range.end) < SUMMARY_BEFORE_END_DAYS) return calendarMonthId;
  if (daysBetween(range.start, today) < SUMMARY_AFTER_START_DAYS) {
    return addMonthId(calendarMonthId, -1);
  }
  return null;
}

function cents(value: number) {
  return Math.round(value * 100) / 100;
}
