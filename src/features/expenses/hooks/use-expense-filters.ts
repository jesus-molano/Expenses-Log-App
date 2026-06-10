"use client";

import { addDays, endOfMonth, startOfMonth, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";
import type { SmartList } from "../lib/dashboard-config";

export function useExpenseFilters(store: ExpenseStore) {
  const [selectedList, setSelectedList] = useState<SmartList>("today");
  const [selectedTag, setSelectedTag] = useState("all");
  const [query, setQuery] = useState("");

  const today = toDateOnly(new Date());
  const windowStart = toDateOnly(subDays(new Date(), 45));
  const windowEnd = toDateOnly(addDays(new Date(), 90));

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

  const tags = useMemo(
    () => Array.from(new Set(store.templates.flatMap((template) => template.tags))).sort(),
    [store.templates],
  );

  const visibleOccurrences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const monthStart = toDateOnly(startOfMonth(new Date()));
    const monthEnd = toDateOnly(endOfMonth(new Date()));
    const upcomingEnd = toDateOnly(addDays(new Date(), 30));

    return occurrences.filter((occurrence) => {
      const matchesQuery =
        !normalizedQuery ||
        occurrence.template.name.toLowerCase().includes(normalizedQuery) ||
        occurrence.template.description.toLowerCase().includes(normalizedQuery);
      const matchesTag =
        selectedTag === "all" || occurrence.template.tags.includes(selectedTag);

      if (!matchesQuery || !matchesTag) return false;
      if (selectedList === "paid") return occurrence.status === "paid";
      if (selectedList === "today") {
        return (
          occurrence.status !== "paid" &&
          (occurrence.dueDate === today || occurrence.estimatedChargeDate === today)
        );
      }
      if (selectedList === "upcoming") {
        return (
          occurrence.status !== "paid" &&
          occurrence.dueDate >= today &&
          occurrence.dueDate <= upcomingEnd
        );
      }
      return occurrence.dueDate >= monthStart && occurrence.dueDate <= monthEnd;
    });
  }, [occurrences, query, selectedList, selectedTag, today]);

  const pendingTotal = visibleOccurrences
    .filter((occurrence) => occurrence.status !== "paid")
    .reduce((sum, occurrence) => sum + occurrence.template.amount, 0);

  return {
    query,
    selectedList,
    selectedTag,
    tags,
    today,
    pendingTotal,
    pendingTotalLabel: formatCurrency(pendingTotal),
    visibleOccurrences,
    setQuery,
    setSelectedList,
    setSelectedTag,
  };
}
