"use client";

import { endOfMonth, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildRecurringOverview } from "../lib/recurring-overview";
import { buildTimelineSections } from "../lib/timeline";

export function useExpenseFilters(store: ExpenseStore, language: AppLanguage) {
  const today = toDateOnly(new Date());
  const windowStart = toDateOnly(startOfMonth(new Date()));
  const windowEnd = toDateOnly(endOfMonth(new Date()));

  const occurrences = useMemo(
    () =>
      generateOccurrences(
        store.templates,
        store.overrides,
        windowStart,
        windowEnd,
      ),
    [store.templates, store.overrides, windowStart, windowEnd],
  );

  const recurringOverviewItems = useMemo(
    () =>
      buildRecurringOverview({
        templates: store.templates,
        overrides: store.overrides,
        windowStart,
        windowEnd,
      }),
    [store.templates, store.overrides, windowStart, windowEnd],
  );

  const visibleOccurrences = useMemo(
    () => occurrences.filter((occurrence) => occurrence.status !== "skipped"),
    [occurrences],
  );

  const pendingTotal = visibleOccurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "paid" &&
        occurrence.status !== "skipped" &&
        occurrence.dueDate >= windowStart &&
        occurrence.dueDate <= windowEnd &&
        occurrence.estimatedChargeDate <= windowEnd,
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
