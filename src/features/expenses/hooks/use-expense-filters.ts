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

  // Del mes siguiente se ven sus primeros días y, entero, lo ya pagado por
  // adelantado ("Ya pagado de noviembre", al final del timeline).
  const nextMonthEnd = monthRange(addMonthId(monthId, 1)).end;
  const paidAhead = occurrencesDueBetween(
    store,
    toDateOnly(addDays(parseISO(timelineWindowEnd), 1)),
    nextMonthEnd,
    language,
  ).filter((occurrence) => occurrence.status === "paid");

  const visibleOccurrences = [
    ...selectCarryOverOccurrences(store, todayDate, language, monthId),
    ...occurrencesDueBetween(store, windowStart, timelineWindowEnd, language),
    ...paidAhead,
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
    recurringOverviewItems,
  };
}
