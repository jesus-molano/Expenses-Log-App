"use client";

import { useCallback } from "react";
import { suggestedPaidAmount } from "@/domain/amount-history";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { useSeriesAmountPrompt } from "@/features/expenses/hooks/use-series-amount-prompt";
import type { MonthlyExpenseOverrideInput } from "@/stores/app/store-types";

// Editar un recibo del mes desde la lista de Mes. Si se pagó otro importe, se
// pregunta si los próximos cobros pasan a costar eso; al editar lo pagado se
// sugiere la media de los últimos pagos.
export function useMonthlyExpenseActions({
  store,
  language,
  updateMonthlyExpenseOccurrence,
  setSeriesAmount,
}: {
  store: ExpenseStore;
  language: AppLanguage;
  updateMonthlyExpenseOccurrence: (input: MonthlyExpenseOverrideInput) => void;
  setSeriesAmount: (templateId: string, amount: number) => void;
}) {
  const seriesPrompt = useSeriesAmountPrompt({ store, setSeriesAmount });
  const suggestPaidAmount = useCallback(
    (occurrence: ExpenseOccurrence) =>
      suggestedPaidAmount(store, occurrence.template.id, occurrence.occurrenceDate, language),
    [language, store],
  );

  function updateMonthlyExpense(input: MonthlyExpenseOverrideInput) {
    updateMonthlyExpenseOccurrence(input);
    if (
      input.status === "paid" &&
      input.amountPaid !== undefined &&
      input.amountPaid !== input.amount
    ) {
      seriesPrompt.askAfterPayment(input.templateId, input.amountPaid);
    }
  }

  return { seriesPrompt, suggestPaidAmount, updateMonthlyExpense };
}
