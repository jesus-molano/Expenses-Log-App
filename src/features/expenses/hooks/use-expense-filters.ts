"use client";

import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildRecurringOverview } from "../lib/recurring-overview";
import { buildTimelineSections } from "../lib/timeline";

const NEXT_MONTH_VISIBLE_DAYS = 7;

export function useExpenseFilters(store: ExpenseStore, language: AppLanguage) {
  const today = toDateOnly(new Date());
  const windowStart = toDateOnly(startOfMonth(new Date()));
  const currentMonthEnd = toDateOnly(endOfMonth(new Date()));
  const timelineWindowEnd = toDateOnly(
    addDays(
      startOfMonth(addMonths(new Date(), 1)),
      NEXT_MONTH_VISIBLE_DAYS - 1,
    ),
  );

  const occurrences = useMemo(
    () =>
      generateOccurrences(
        store.templates,
        store.overrides,
        windowStart,
        timelineWindowEnd,
        language,
      ),
    [store.templates, store.overrides, windowStart, timelineWindowEnd, language],
  );

  const recurringOverviewItems = useMemo(
    () =>
      buildRecurringOverview({
        templates: store.templates,
        overrides: store.overrides,
        windowStart,
        windowEnd: currentMonthEnd,
        language,
      }),
    [store.templates, store.overrides, windowStart, currentMonthEnd, language],
  );

  const visibleOccurrences = useMemo(
    () =>
      occurrences.filter(
        (occurrence) =>
          occurrence.status !== "skipped" &&
          (occurrence.occurrenceDate <= currentMonthEnd ||
            occurrence.dueDate <= timelineWindowEnd),
      ),
    [occurrences, currentMonthEnd, timelineWindowEnd],
  );

  const pendingTotal = visibleOccurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "paid" &&
        occurrence.status !== "skipped" &&
        occurrence.dueDate >= windowStart &&
        occurrence.dueDate <= currentMonthEnd &&
        occurrence.estimatedChargeDate <= currentMonthEnd,
    )
    .reduce((sum, occurrence) => sum + occurrence.template.amount, 0);
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
