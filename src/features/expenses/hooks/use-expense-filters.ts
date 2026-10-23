"use client";

import { useMemo } from "react";
import { addDays, parseISO } from "date-fns";
import {
  addMonthId,
  monthPendingSummary,
  monthRange,
  selectCarryOverOccurrences,
} from "@/domain/budget-month";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { occurrencesDueBetween } from "@/domain/finance";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildTimelineSections } from "../lib/timeline";

const NEXT_MONTH_VISIBLE_DAYS = 7;

// `monthId` es el mes que se mira (el activo por defecto); `now`, el día real.
export function useExpenseFilters(
  store: ExpenseStore,
  language: AppLanguage,
  now: Date,
  monthId: string = toDateOnly(now).slice(0, 7),
) {
  const today = toDateOnly(now);

  return useMemo(
    () => buildExpenseFilters(store, language, parseISO(today), monthId),
    [store, language, today, monthId],
  );
}

function buildExpenseFilters(
  store: ExpenseStore,
  language: AppLanguage,
  todayDate: Date,
  monthId: string,
) {
  const today = toDateOnly(todayDate);
  const { start: windowStart } = monthRange(monthId);
  const timelineWindowEnd = toDateOnly(
    addDays(
      parseISO(monthRange(addMonthId(monthId, 1)).start),
      NEXT_MONTH_VISIBLE_DAYS - 1,
    ),
  );

  const visibleOccurrences = [
    ...selectCarryOverOccurrences(store, todayDate, language, monthId),
    ...occurrencesDueBetween(store, windowStart, timelineWindowEnd, language),
  ].filter((occurrence) => occurrence.status !== "skipped");

  const pendingTotal = monthPendingSummary(visibleOccurrences, monthId).total;
  const timelineSections = buildTimelineSections(
    visibleOccurrences,
    today,
    language,
    monthId,
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
  };
}
