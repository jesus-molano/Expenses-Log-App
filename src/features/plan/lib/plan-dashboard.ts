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

// Plan de un mes de presupuesto con sus días y el mes en que cae hoy.
export function buildPlanForMonth({
  store,
  monthDate,
  today,
  language,
  cycle = CALENDAR_CYCLE,
  includeExtraIncome = true,
}: {
  store: ExpenseStore;
  monthDate: Date;
  today: Date;
  language: AppLanguage;
  cycle?: BudgetCycle;
  includeExtraIncome?: boolean;
}) {
  return buildMonthlyMoneyPlan({
    monthDate,
    finance: store.finance,
    occurrences: occurrencesForMonth(store, monthDate, language, cycle),
    today,
    includeExtraIncome,
    range: periodRange(toMonthId(monthDate), cycle),
    currentMonthId: periodIdOf(toDateOnly(today), cycle),
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

export function buildSeriesItem(
  store: ExpenseStore,
  monthDate: Date,
  today: Date,
  language: AppLanguage,
  cycle: BudgetCycle = CALENDAR_CYCLE,
): MoneySeriesItem {
  const locale = language === "en" ? enUS : es;
  const monthId = toDateOnly(startOfMonth(monthDate));
  const plan = buildPlanForMonth({
    store,
    monthDate,
    today,
    language,
    cycle,
    includeExtraIncome:
      toMonthId(monthDate) <= periodIdOf(toDateOnly(today), cycle),
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
  copy: ReturnType<typeof planCopy>,
) {
  if (phase === "projected") return copy.projected;
  if (phase === "current") return copy.current;
  return copy.registered;
}

export function planCopy(language: AppLanguage) {
  if (language === "en") {
    return {
      toPay: "To pay",
      planFor: "Plan for",
      of: "of",
      paidReceipts: "receipts paid",
      noReceipts: "No recurring receipts this month.",
      paidProgress: "Paid receipts progress",
      overdue: "Overdue",
      nextReceipt: "Next receipt",
      allPaid: "Everything planned is paid",
      noUpcomingReceipt: "No upcoming receipt",
      monthEquation: "Month overview",
      expectedIncome: "Expected income",
      fixedIncome: "Fixed",
      extras: "extras",
      expectedFinalExpenses: "Expected final recurring cost",
      paid: "Paid",
      pending: "pending",
      reservedSavings: "Reserved savings",
      goal: "Goal",
      actual: "Actual",
      freeAccordingToPlan: "Free according to plan",
      freeDisclaimer: "Full-month projection. It is not your bank balance and does not include small day-to-day spending.",
      missingForReceipts: "Missing for receipts:",
      unfundedGoal: "Savings goal not funded by this plan:",
      savingsThisMonth: "Savings this month",
      pendingReceipts: "Pending receipts",
      quickActions: "Plan actions",
      extraIncome: "Add one-off income",
      annualPlan: "Annual plan",
      annualSubtitle: "Twelve registered, current and projected months.",
      annualRecurring: "Planned recurring",
      annualPaid: "Paid recorded",
      savedThisYear: "Actually saved",
      annualCapacity: "Maximum capacity",
      monthlyReview: "Monthly review",
      comparedWithPrevious: "Compared with the previous calendar month.",
      legacyDerived: "Legacy-derived history",
      recurringExpenses: "Recurring expenses",
      actualSavings: "Actual savings",
      editFixedIncome: "Edit fixed income",
      editSavings: "Edit savings",
      monthlyGoal: "Monthly goal",
      actualTransfer: "Actual transfer",
      legacySavingDate: "Imported amount: transfer date was not recorded.",
      singleContribution: "There is one editable savings contribution per month. Enter 0 to remove it.",
      saveSavings: "Save savings",
      projected: "Projected",
      current: "Current month",
      registered: "Registered",
    };
  }

  return {
    toPay: "Por pagar",
    planFor: "Plan de",
    of: "de",
    paidReceipts: "recibos pagados",
    noReceipts: "Sin recibos recurrentes este mes.",
    paidProgress: "Progreso de recibos pagados",
    overdue: "Vencido",
    nextReceipt: "Próximo recibo",
    allPaid: "Todo lo previsto está pagado",
    noUpcomingReceipt: "No hay un próximo recibo",
    monthEquation: "Resumen del mes",
    expectedIncome: "Ingresos previstos",
    fixedIncome: "Fijo",
    extras: "extras",
    expectedFinalExpenses: "Gasto recurrente final previsto",
    paid: "Pagado",
    pending: "pendiente",
    reservedSavings: "Ahorro reservado",
    goal: "Objetivo",
    actual: "Real",
    freeAccordingToPlan: "Libre según el plan",
    freeDisclaimer: "Proyección del mes completo. No es el saldo bancario y no incluye los gastos pequeños del día a día.",
    missingForReceipts: "Faltan para pagar recibos:",
    unfundedGoal: "Objetivo de ahorro que este plan no financia:",
    savingsThisMonth: "Ahorro de este mes",
    pendingReceipts: "Recibos pendientes",
    quickActions: "Acciones del plan",
    extraIncome: "Añadir ingreso extra",
    annualPlan: "Plan anual",
    annualSubtitle: "Doce meses registrados, actuales o proyectados.",
    annualRecurring: "Recurrente previsto",
    annualPaid: "Pagado registrado",
    savedThisYear: "Ahorrado real",
    annualCapacity: "Capacidad máxima",
    monthlyReview: "Revisión mensual",
    comparedWithPrevious: "Comparado con el mes natural anterior.",
    legacyDerived: "Histórico derivado",
    recurringExpenses: "Gastos recurrentes",
    actualSavings: "Ahorro real",
    editFixedIncome: "Editar ingreso fijo",
    editSavings: "Editar ahorro",
    monthlyGoal: "Objetivo mensual",
    actualTransfer: "Transferencia real",
    legacySavingDate: "Importe heredado: no se registró la fecha de transferencia.",
    singleContribution: "Hay una sola aportación editable por mes. Escribe 0 para eliminarla.",
    saveSavings: "Guardar ahorro",
    projected: "Proyectado",
    current: "Mes actual",
    registered: "Registrado",
  };
}
