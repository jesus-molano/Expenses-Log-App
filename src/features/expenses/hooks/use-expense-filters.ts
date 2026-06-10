"use client";

import { addDays, endOfMonth, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";
import { buildTimelineSections } from "../lib/timeline";

export function useExpenseFilters(store: ExpenseStore) {
  const [query, setQuery] = useState("");

  const today = toDateOnly(new Date());
  const windowStart = toDateOnly(subDays(new Date(), 14));
  const windowEnd = toDateOnly(addDays(new Date(), 365));

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

  const visibleOccurrences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return occurrences.filter((occurrence) => {
      const matchesQuery =
        !normalizedQuery ||
        occurrence.template.name.toLowerCase().includes(normalizedQuery) ||
        occurrence.template.description.toLowerCase().includes(normalizedQuery) ||
        occurrence.template.tags.some((tag) => tag.includes(normalizedQuery));

      return matchesQuery;
    });
  }, [occurrences, query]);

  const monthEnd = toDateOnly(endOfMonth(new Date()));
  const pendingTotal = visibleOccurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "paid" &&
        occurrence.estimatedChargeDate >= today &&
        occurrence.estimatedChargeDate <= monthEnd,
    )
    .reduce((sum, occurrence) => sum + occurrence.template.amount, 0);
  const timelineSections = buildTimelineSections(visibleOccurrences, today);
  const nextOccurrence =
    visibleOccurrences.find((occurrence) => occurrence.status !== "paid") ?? null;

  return {
    query,
    today,
    pendingTotal,
    pendingTotalLabel: formatCurrency(pendingTotal),
    nextOccurrence,
    visibleOccurrences,
    timelineSections,
    setQuery,
  };
}
