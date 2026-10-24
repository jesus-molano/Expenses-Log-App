import { addDays, parseISO } from "date-fns";
import { CALENDAR_CYCLE, periodIdOf } from "@/domain/budget-cycle";
import { daysBetween, toDateOnly } from "@/domain/calendar";
import type { AppLanguage, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  COST_WINDOW_MONTHS,
  costWindow,
  isLongCycleRule,
  roundCents,
  upcomingRecurringCharges,
  type InsightOptions,
} from "./recurring-costs";

export type ProvisionItem = {
  template: ExpenseTemplate;
  // Coste de los próximos doce meses y su parte mensual.
  annual: number;
  monthly: number;
  next: {
    dueDate: string;
    amount: number;
    // Meses de presupuesto hasta el cobro, contando el actual (1 = este mes).
    monthsUntil: number;
    // Lo que hay que apartar cada mes desde ahora para llegar a tiempo.
    perMonthUntilDue: number;
  } | null;
};

export type ProvisionPlan = {
  // Lo que hay que apartar este mes para llegar a tiempo a cada próximo
  // recibo: la suma de lo que pide cada uno hasta su fecha.
  monthlyToSetAside: number;
  // Media a largo plazo: el coste de los próximos doce meses entre doce.
  monthlyTotal: number;
  annualTotal: number;
  items: ProvisionItem[];
};

// Provisión para los recibos que no se pagan cada mes (seguro, IBI...): para
// el próximo cobro de cada uno, cuánto apartar al mes hasta entonces, y la
// suma de todo eso como lo que hay que apartar este mes. La media (coste de
// los próximos doce meses entre doce) es menor cuando un recibo grande llega
// pronto, así que solo se muestra como referencia.
export function buildProvisionPlan(
  store: ExpenseStore,
  { monthId, cycle = CALENDAR_CYCLE, language = "es" }: InsightOptions,
): ProvisionPlan {
  const window = costWindow(monthId, cycle);
  // Un año más para encontrar el próximo cobro de lo que ya se pagó este año.
  const horizon = costWindow(monthId, cycle, COST_WINDOW_MONTHS * 2);
  const byTemplate = new Map<string, ProvisionItem>();

  for (const { occurrence, template, amount } of upcomingRecurringCharges(
    store,
    horizon,
    language,
  )) {
    if (!isLongCycleRule(template.recurrence)) continue;
    const item = byTemplate.get(template.id) ?? {
      template,
      annual: 0,
      monthly: 0,
      next: null,
    };
    if (occurrence.dueDate <= window.end) item.annual += amount;
    if (!item.next && occurrence.status === "due") {
      const monthsUntil = Math.max(
        monthDistance(monthId, periodIdOf(occurrence.dueDate, cycle)) + 1,
        1,
      );
      item.next = {
        dueDate: occurrence.dueDate,
        amount,
        monthsUntil,
        perMonthUntilDue: roundCents(amount / monthsUntil),
      };
    }
    byTemplate.set(template.id, item);
  }

  const items = Array.from(byTemplate.values())
    .map((item) => ({
      ...item,
      annual: roundCents(item.annual),
      monthly: roundCents(item.annual / COST_WINDOW_MONTHS),
    }))
    .filter((item) => item.annual > 0 || item.next)
    .sort(
      (a, b) =>
        (a.next?.dueDate ?? "9999").localeCompare(b.next?.dueDate ?? "9999") ||
        a.template.name.localeCompare(b.template.name),
    );
  const annualTotal = roundCents(items.reduce((sum, item) => sum + item.annual, 0));
  // Lo que vence este mes ya está en lo que hay que pagar del mes: no se
  // aparta aparte.
  const monthlyToSetAside = roundCents(
    items.reduce((sum, item) => {
      if (!item.next) return sum + item.monthly;
      return item.next.monthsUntil <= 1 ? sum : sum + item.next.perMonthUntilDue;
    }, 0),
  );

  return {
    monthlyToSetAside,
    monthlyTotal: roundCents(annualTotal / COST_WINDOW_MONTHS),
    annualTotal,
    items,
  };
}

export const LARGE_BILL_DAYS = 90;
export const LARGE_BILL_MIN_AMOUNT = 50;

export type LargeBill = {
  occurrenceId: string;
  name: string;
  dueDate: string;
  chargeDate: string;
  amount: number;
  daysUntil: number;
};

// Recibos grandes que llegan en los próximos 90 días: los no mensuales y los
// pagos únicos de al menos 50 €, aún sin pagar. Lo mensual ya está en el plan
// de cada mes y no sorprende.
export function buildLargeUpcomingBills(
  store: ExpenseStore,
  {
    today,
    language = "es",
    days = LARGE_BILL_DAYS,
    minAmount = LARGE_BILL_MIN_AMOUNT,
  }: {
    today: string;
    language?: AppLanguage;
    days?: number;
    minAmount?: number;
  },
) {
  // Desde unos días antes: lo que vence en fin de semana o festivo se cobra
  // después y aún no ha pasado.
  const range = {
    start: toDateOnly(addDays(parseISO(today), -7)),
    end: toDateOnly(addDays(parseISO(today), days)),
  };
  const items: LargeBill[] = upcomingRecurringCharges(store, range, language, {
    includeOnce: true,
  })
    .filter(
      ({ occurrence, template, amount }) =>
        occurrence.status === "due" &&
        occurrence.estimatedChargeDate >= today &&
        occurrence.dueDate <= range.end &&
        amount >= minAmount &&
        (template.recurrence.frequency === "once" || isLongCycleRule(template.recurrence)),
    )
    .map(({ occurrence, template, amount }) => ({
      occurrenceId: occurrence.id,
      name: occurrence.template.name || template.name,
      dueDate: occurrence.dueDate,
      chargeDate: occurrence.estimatedChargeDate,
      amount,
      daysUntil: daysBetween(today, occurrence.estimatedChargeDate),
    }))
    .sort((a, b) => a.chargeDate.localeCompare(b.chargeDate) || a.name.localeCompare(b.name));

  return {
    items,
    total: roundCents(items.reduce((sum, item) => sum + item.amount, 0)),
  };
}

function monthDistance(fromMonthId: string, toMonthId: string) {
  const [fromYear, fromMonth] = fromMonthId.split("-").map(Number);
  const [toYear, toMonth] = toMonthId.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}
