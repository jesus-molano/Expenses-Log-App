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
import { buildRecurringOverview } from "../lib/recurring-overview";
import { buildTimelineSections } from "../lib/timeline";

// Primeros días del mes siguiente que se resumen al final del mes visto.
const NEXT_MONTH_PREVIEW_DAYS = 7;

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
  // Cada mes muestra solo sus cobros (más lo pendiente que arrastre): lo del
  // mes siguiente se ve avanzando o mirando ese mes.
  const { start: windowStart, end: windowEnd } = monthRange(monthId);
  const nextMonthId = addMonthId(monthId, 1);
  const nextMonthStart = monthRange(nextMonthId).start;
  const previewEnd = toDateOnly(
    addDays(parseISO(nextMonthStart), NEXT_MONTH_PREVIEW_DAYS - 1),
  );

  // La vista de series se mide siempre contra el mes natural: mirar otro mes
  // no convierte en atrasado lo que vence más adelante en este.
  const calendarMonth = monthRange(today.slice(0, 7));
  const recurringOverviewItems = buildRecurringOverview({
    templates: store.templates,
    overrides: store.overrides,
    windowStart: calendarMonth.start,
    windowEnd: calendarMonth.end,
    language,
  });

  const visibleOccurrences = [
    ...selectCarryOverOccurrences(store, todayDate, language, monthId),
    ...occurrencesDueBetween(store, windowStart, windowEnd, language),
  ].filter((occurrence) => occurrence.status !== "skipped");
  const upcoming = occurrencesDueBetween(store, nextMonthStart, previewEnd, language).filter(
    (occurrence) => occurrence.status === "due",
  );
  const nextMonthPreview = upcoming.length
    ? {
        monthId: nextMonthId,
        count: upcoming.length,
        total: upcoming.reduce((sum, occurrence) => sum + occurrence.template.amount, 0),
      }
    : null;

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
    nextMonthPreview,
    visibleOccurrences,
    timelineSections,
    recurringOverviewItems,
  };
}
