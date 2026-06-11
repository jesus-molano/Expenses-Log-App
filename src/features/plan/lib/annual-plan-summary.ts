import { endOfMonth, startOfMonth } from "date-fns";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { getMonthlySavingsTarget, toMonthId } from "@/domain/finance";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";

export type AnnualPlanSummary = {
  annualExpensesTotal: number;
  annualExpensesTotalLabel: string;
  annualSavingsEstimate: number;
  annualSavingsEstimateLabel: string;
  firstMonthId: string | null;
};

export function buildAnnualPlanSummary({
  store,
  selectedYear,
  today,
}: {
  store: ExpenseStore;
  selectedYear: number;
  today: Date;
}): AnnualPlanSummary {
  const firstMonthId = getFirstMonthWithData(store, selectedYear);
  if (!firstMonthId) {
    return {
      annualExpensesTotal: 0,
      annualExpensesTotalLabel: formatCurrency(0),
      annualSavingsEstimate: 0,
      annualSavingsEstimateLabel: formatCurrency(0),
      firstMonthId: null,
    };
  }

  const annualOccurrences = generateOccurrences(
    store.templates,
    store.overrides,
    `${firstMonthId}-01`,
    toDateOnly(endOfMonth(new Date(selectedYear, 11, 1))),
  );
  const annualExpensesTotal = annualOccurrences.reduce(
    (sum, occurrence) =>
      occurrence.status === "skipped"
        ? sum
        : sum + occurrence.template.amount,
    0,
  );
  const annualSavingsEstimate = estimateSavingsFromFirstDataMonth({
    store,
    firstMonthId,
    selectedYear,
    todayMonthId: toMonthId(today),
  });

  return {
    annualExpensesTotal,
    annualExpensesTotalLabel: formatCurrency(annualExpensesTotal),
    annualSavingsEstimate,
    annualSavingsEstimateLabel: formatCurrency(annualSavingsEstimate),
    firstMonthId,
  };
}

function getFirstMonthWithData(
  store: ExpenseStore,
  selectedYear: number,
): string | null {
  const monthIds = new Set<string>();
  const yearOccurrences = generateOccurrences(
    store.templates,
    store.overrides,
    `${selectedYear}-01-01`,
    `${selectedYear}-12-31`,
  );

  for (const occurrence of yearOccurrences) {
    monthIds.add(occurrence.dueDate.slice(0, 7));
  }
  for (const event of store.finance.incomeEvents) {
    if (event.receivedAt.startsWith(`${selectedYear}-`)) {
      monthIds.add(event.receivedAt.slice(0, 7));
    }
  }
  const monthlyTargets = store.finance.allocation.monthlySavingsTargets ?? {};
  for (const monthId of Object.keys(monthlyTargets)) {
    if (monthId.startsWith(`${selectedYear}-`)) {
      monthIds.add(monthId);
    }
  }

  return Array.from(monthIds).sort()[0] ?? null;
}

function estimateSavingsFromFirstDataMonth({
  store,
  firstMonthId,
  selectedYear,
  todayMonthId,
}: {
  store: ExpenseStore;
  firstMonthId: string;
  selectedYear: number;
  todayMonthId: string;
}): number {
  const monthIds = monthsFrom(firstMonthId, selectedYear);
  const monthlyTargets = store.finance.allocation.monthlySavingsTargets ?? {};
  const explicitTargets = Object.entries(monthlyTargets).filter(
    ([monthId]) =>
      monthId.startsWith(`${selectedYear}-`) && monthId >= firstMonthId,
  );
  const averageTarget =
    explicitTargets.length > 0
      ? explicitTargets.reduce(
          (sum, [, amount]) => sum + Math.max(Number(amount), 0),
          0,
        ) /
        explicitTargets.length
      : 0;

  return monthIds.reduce((sum, monthId) => {
    const explicitTarget = getMonthlySavingsTarget(store.finance, monthId);
    if (monthId in monthlyTargets) {
      return sum + explicitTarget;
    }

    return sum + (monthId >= todayMonthId ? averageTarget : 0);
  }, 0);
}

function monthsFrom(firstMonthId: string, selectedYear: number): string[] {
  const firstMonth = Number(firstMonthId.slice(5, 7)) - 1;

  return Array.from({ length: 12 - firstMonth }, (_, index) =>
    toMonthId(startOfMonth(new Date(selectedYear, firstMonth + index, 1))),
  );
}
