"use client";

import { type FormEvent, useMemo, useState } from "react";
import { suggestedPaidAmount } from "@/domain/amount-history";
import { paidAmount } from "@/domain/finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import { type SeriesAmountPrompt, useSeriesAmountPrompt } from "./use-series-amount-prompt";

type UsePayAmountFlowOptions = {
  store: ExpenseStore;
  language: AppLanguage;
  payOccurrence: (occurrence: ExpenseOccurrence, amountPaid: number) => void;
  setSeriesAmount: (templateId: string, amount: number) => void;
  onSeriesUpdated?: (prompt: SeriesAmountPrompt) => void;
};

// Pagar un cobro con lo que costó de verdad (recibos variables): sugiere la
// media de los últimos pagos y, si el importe cambia, pregunta si los próximos
// cobros pasan a costar eso.
export function usePayAmountFlow({
  store,
  language,
  payOccurrence,
  setSeriesAmount,
  onSeriesUpdated,
}: UsePayAmountFlowOptions) {
  const [occurrence, setOccurrence] = useState<ExpenseOccurrence | null>(null);
  const [amountText, setAmountText] = useState("");
  const seriesPrompt = useSeriesAmountPrompt({ store, setSeriesAmount });
  const suggestion = useMemo(
    () =>
      occurrence
        ? suggestedPaidAmount(
            store,
            occurrence.template.id,
            occurrence.occurrenceDate,
            language,
          )
        : null,
    [language, occurrence, store],
  );

  function open(target: ExpenseOccurrence) {
    seriesPrompt.dismiss();
    setOccurrence(target);
    setAmountText(
      formatMoneyInput(
        target.status === "paid" ? paidAmount(target) : target.template.amount,
        language,
      ),
    );
  }

  function close() {
    seriesPrompt.dismiss();
    setOccurrence(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!occurrence) return;
    const amount = parseMoneyInput(amountText);
    // El campo valida antes de enviar; esto solo protege de un importe vacío.
    if (amount === null || amount <= 0) return;
    payOccurrence(occurrence, amount);
    if (
      amount !== occurrence.template.amount &&
      seriesPrompt.askAfterPayment(occurrence.template.id, amount)
    ) {
      return;
    }
    close();
  }

  function applySeries() {
    const applied = seriesPrompt.apply();
    close();
    if (applied) onSeriesUpdated?.(applied);
  }

  return {
    occurrence,
    amountText,
    suggestion,
    seriesPrompt: seriesPrompt.prompt,
    setAmountText,
    open,
    close,
    save,
    applySeries,
  };
}
