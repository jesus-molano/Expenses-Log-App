"use client";

import { useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import { type SeriesAmountPrompt, seriesAmountPromptFor } from "@/domain/series-lifecycle";
import type { ExpenseStore } from "@/domain/types";

export type { SeriesAmountPrompt };

type UseSeriesAmountPromptOptions = {
  store: ExpenseStore;
  setSeriesAmount: (templateId: string, amount: number) => void;
};

// "¿Actualizar el importe desde ahora?" tras pagar un recibo con otro importe.
export function useSeriesAmountPrompt({
  store,
  setSeriesAmount,
}: UseSeriesAmountPromptOptions) {
  const [prompt, setPrompt] = useState<SeriesAmountPrompt | null>(null);

  function askAfterPayment(templateId: string, paidAmount: number, now = new Date()) {
    const next = seriesAmountPromptFor(store, templateId, paidAmount, toDateOnly(now));
    setPrompt(next);
    return next !== null;
  }

  function apply() {
    if (!prompt) return null;
    setSeriesAmount(prompt.templateId, prompt.to);
    setPrompt(null);
    return prompt;
  }

  return {
    prompt,
    askAfterPayment,
    apply,
    dismiss: () => setPrompt(null),
  };
}
