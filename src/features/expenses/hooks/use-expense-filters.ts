"use client";

import { useMemo } from "react";
import { addDays, addMonths, endOfMonth, parseISO, startOfMonth } from "date-fns";
import {
  monthPendingSummary,
  selectCarryOverOccurrences,
} from "@/domain/budget-month";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { occurrencesDueBetween } from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildRecurringOverview } from "../lib/recurring-overview";
import { buildTimelineSections } from "../lib/timeline";

const NEXT_MONTH_VISIBLE_DAYS = 7;

export function useExpenseFilters(
  store: ExpenseStore,
  language: AppLanguage,
  now: Date,
) {
  const today = toDateOnly(now);

  return useMemo(
    () => buildExpenseFilters(store, language, parseISO(today)),
    [store, language, today],
  );
}

function buildExpenseFilters(
  store: ExpenseStore,
  language: AppLanguage,
  todayDate: Date,
) {
  const today = toDateOnly(todayDate);
  const currentMonthId = today.slice(0, 7);
  const windowStart = toDateOnly(startOfMonth(todayDate));
  const currentMonthEnd = toDateOnly(endOfMonth(todayDate));
  const timelineWindowEnd = toDateOnly(
    addDays(
      startOfMonth(addMonths(todayDate, 1)),
      NEXT_MONTH_VISIBLE_DAYS - 1,
    ),
  );

  const recurringOverviewItems = buildRecurringOverview({
    templates: store.templates,
    overrides: store.overrides,
    windowStart,
    windowEnd: currentMonthEnd,
    language,
  });

  const visibleOccurrences = [
    ...selectCarryOverOccurrences(store, todayDate, language),
    ...occurrencesDueBetween(store, windowStart, timelineWindowEnd, language),
  ].filter((occurrence) => occurrence.status !== "skipped");

  const pendingTotal = monthPendingSummary(
    visibleOccurrences,
    currentMonthId,
  ).total;
  const timelineSections = buildTimelineSections(
    visibleOccurrences,
    today,
    language,
  );
  const nextOccurrence =
    visibleOccurrences.find(
      (occurrence) =>
        occurrence.status !== "paid" && occurrence.estimatedChargeDate >= today,
    ) ??
    visibleOccurrences.find((occurrence) => occurrence.status !== "paid") ??
    null;

  return {
    today,
    pendingTotal,
    pendingTotalLabel: formatCurrency(pendingTotal),
    nextOccurrence,
    visibleOccurrences,
    timelineSections,
    recurringOverviewItems,
  };
}
