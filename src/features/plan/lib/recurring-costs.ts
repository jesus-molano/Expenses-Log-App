import {
  addMonthId,
  CALENDAR_CYCLE,
  periodRange,
  type BudgetCycle,
  type DateRange,
} from "@/domain/budget-cycle";
import {
  getMonthSalary,
  occurrenceAmount,
  occurrencesDueBetween,
} from "@/domain/finance";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";

export const COST_WINDOW_MONTHS = 12;

export type UpcomingCharge = {
  occurrence: ExpenseOccurrence;
  // El gasto tal y como está ahora (el de la ocurrencia puede venir de un
  // registro histórico, que no conserva la repetición).
  template: ExpenseTemplate;
  amount: number;
};

export type InsightOptions = {
  // Primer mes de presupuesto que se cuenta: el activo.
  monthId: string;
  cycle?: BudgetCycle;
  language?: AppLanguage;
};

// Los doce meses de presupuesto que empiezan en `monthId`.
export function costWindow(
  monthId: string,
  cycle: BudgetCycle = CALENDAR_CYCLE,
  months = COST_WINDOW_MONTHS,
): DateRange {
  return {
    start: periodRange(monthId, cycle).start,
    end: periodRange(addMonthId(monthId, months - 1), cycle).end,
  };
}

// Cobros de los gastos que siguen existiendo, sin los quitados del mes ni los
// pagos únicos. Lo pagado cuenta por lo que se pagó.
export function upcomingRecurringCharges(
  store: ExpenseStore,
  range: DateRange,
  language: AppLanguage = "es",
  { includeOnce = false }: { includeOnce?: boolean } = {},
): UpcomingCharge[] {
  const templates = new Map(store.templates.map((template) => [template.id, template]));

  return occurrencesDueBetween(store, range.start, range.end, language).flatMap(
    (occurrence) => {
      const template = templates.get(occurrence.template.id);
      if (
        !template ||
        !template.active ||
        occurrence.status === "skipped" ||
        (!includeOnce && template.recurrence.frequency === "once")
      ) {
        return [];
      }
      return [{ occurrence, template, amount: occurrenceAmount(occurrence) }];
    },
  );
}

// Se repite con menos frecuencia que una vez al mes: trimestral, anual, cada
// varios meses o cada más de un mes en días o semanas.
export function isLongCycleRule(rule: RecurrenceRule) {
  const interval = Math.max(rule.interval ?? 1, 1);
  if (rule.frequency === "quarterly" || rule.frequency === "yearly") return true;
  if (rule.frequency === "monthly") return interval > 1;
  if (rule.frequency !== "custom") return false;
  if (rule.unit === "year") return true;
  if (rule.unit === "week") return interval >= 5;
  if (rule.unit === "day") return interval > 31;
  return interval > 1;
}

export type ExpenseCost = {
  templateId: string;
  name: string;
  annual: number;
  monthly: number;
  charges: number;
};

export type CategoryCost = {
  categoryId: string;
  category: ExpenseCategory | null;
  annual: number;
  monthly: number;
  // Parte del total anual (0-1).
  share: number;
  expenses: ExpenseCost[];
};

export type RecurringCostInsights = {
  range: DateRange;
  annualTotal: number;
  monthlyAverage: number;
  // Media mensual frente al sueldo del primer mes (0-1), si hay sueldo.
  salaryShare: number | null;
  categories: CategoryCost[];
};

// "Suscripciones: 47,97 €/mes · 575,64 €/año": coste de los próximos doce
// meses por categoría y por gasto, con la media mensual.
export function buildRecurringCostInsights(
  store: ExpenseStore,
  { monthId, cycle = CALENDAR_CYCLE, language = "es" }: InsightOptions,
): RecurringCostInsights {
  const range = costWindow(monthId, cycle);
  const categoriesById = new Map(store.categories.map((category) => [category.id, category]));
  const byCategory = new Map<string, Map<string, ExpenseCost>>();

  for (const { occurrence, template, amount } of upcomingRecurringCharges(
    store,
    range,
    language,
  )) {
    const categoryId = occurrence.template.categoryId;
    const expenses = byCategory.get(categoryId) ?? new Map<string, ExpenseCost>();
    const expense = expenses.get(template.id) ?? {
      templateId: template.id,
      name: template.name,
      annual: 0,
      monthly: 0,
      charges: 0,
    };
    expense.annual += amount;
    expense.charges += 1;
    expenses.set(template.id, expense);
    byCategory.set(categoryId, expenses);
  }

  const annualTotal = roundCents(
    Array.from(byCategory.values()).reduce(
      (sum, expenses) =>
        sum + Array.from(expenses.values()).reduce((total, item) => total + item.annual, 0),
      0,
    ),
  );
  const categories = Array.from(byCategory.entries())
    .map(([categoryId, expenses]): CategoryCost => {
      const items = Array.from(expenses.values())
        .map((item) => ({
          ...item,
          annual: roundCents(item.annual),
          monthly: roundCents(item.annual / COST_WINDOW_MONTHS),
        }))
        .sort(byAnnualThenName);
      const annual = roundCents(items.reduce((sum, item) => sum + item.annual, 0));
      return {
        categoryId,
        category: categoriesById.get(categoryId) ?? null,
        annual,
        monthly: roundCents(annual / COST_WINDOW_MONTHS),
        share: annualTotal > 0 ? annual / annualTotal : 0,
        expenses: items,
      };
    })
    .sort((a, b) => b.annual - a.annual || (a.category?.name ?? "").localeCompare(b.category?.name ?? ""));
  const monthlyAverage = roundCents(annualTotal / COST_WINDOW_MONTHS);
  // El sueldo del mes activo: lo cobrado si ya se confirmó.
  const salary = getMonthSalary(store.finance, monthId);

  return {
    range,
    annualTotal,
    monthlyAverage,
    salaryShare: salary > 0 ? monthlyAverage / salary : null,
    categories,
  };
}

function byAnnualThenName(a: ExpenseCost, b: ExpenseCost) {
  return b.annual - a.annual || a.name.localeCompare(b.name);
}

export function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}
