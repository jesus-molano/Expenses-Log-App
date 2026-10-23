"use client";

import { useMemo } from "react";
import {
  averagePaidAmount,
  buildChargeHistory,
  buildPriceHistory,
} from "@/domain/amount-history";
import { toDateOnly } from "@/domain/calendar";
import { currentSeriesAmount, seriesLifecycle } from "@/domain/series-lifecycle";
import type { AppLanguage, ExpenseTemplate } from "@/domain/types";
import type { useExpenseStore } from "@/stores/app/use-expense-store";
import { useEndSeriesSheet } from "./use-end-series-sheet";
import { usePauseSeriesSheet } from "./use-pause-series-sheet";
import { usePayAmountFlow } from "./use-pay-amount-flow";
import { usePriceChangeSheet } from "./use-price-change-sheet";

// Cobros que se listan en el detalle; la media mira algunos más.
const VISIBLE_CHARGES = 6;
const AVERAGE_WINDOW = 24;

type UseSeriesDetailOptions = {
  template: ExpenseTemplate;
  expenseStore: ReturnType<typeof useExpenseStore>;
  language: AppLanguage;
  now: Date;
};

// Lo que el detalle de un gasto enseña además del formulario: estado de la
// suscripción, precio y últimos cobros, con sus hojas de acción.
export function useSeriesDetail({
  template,
  expenseStore,
  language,
  now,
}: UseSeriesDetailOptions) {
  const { store } = expenseStore;
  const today = toDateOnly(now);
  const lifecycle = seriesLifecycle(template, today);
  const currentAmount = currentSeriesAmount(template, today, store.finance.monthClosures);
  const scheduledChanges = (template.amountChanges ?? []).filter(
    (change) => change.from > today,
  );
  const priceHistory = useMemo(
    () => buildPriceHistory(store, template.id, today, { language }),
    [language, store, template.id, today],
  );
  const chargeHistory = useMemo(
    () => buildChargeHistory(store, template.id, today, { language, limit: AVERAGE_WINDOW }),
    [language, store, template.id, today],
  );

  return {
    today,
    repeats: template.recurrence.frequency !== "once",
    lifecycle,
    currentAmount,
    scheduledChanges,
    priceHistory,
    recentCharges: chargeHistory.slice(0, VISIBLE_CHARGES),
    average: averagePaidAmount(chargeHistory.map((entry) => entry.occurrence)),
    endSheet: useEndSeriesSheet({
      store,
      template,
      now,
      endSeries: expenseStore.endSeries,
    }),
    pauseSheet: usePauseSeriesSheet({
      store,
      template,
      now,
      pauseSeries: expenseStore.pauseSeries,
    }),
    priceSheet: usePriceChangeSheet({
      template,
      currentAmount,
      finance: store.finance,
      now,
      language,
      scheduleAmountChange: expenseStore.scheduleAmountChange,
    }),
    payFlow: usePayAmountFlow({
      store,
      language,
      payOccurrenceWithAmount: expenseStore.payOccurrenceWithAmount,
      setSeriesAmount: expenseStore.setSeriesAmount,
    }),
    reactivate: () => expenseStore.reactivateSeries(template.id),
    resume: () => expenseStore.resumeSeries(template.id),
    removePause: () => {
      if (lifecycle.pause) expenseStore.removePause(template.id, lifecycle.pause.pause.from);
    },
    removeAmountChange: (from: string) => expenseStore.removeAmountChange(template.id, from),
  };
}
