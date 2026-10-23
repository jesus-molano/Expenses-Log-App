"use client";

import { useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import {
  currentSeriesAmount,
  seriesHasUpcomingCharges,
} from "@/domain/series-lifecycle";
import type { ExpenseStore } from "@/domain/types";

export type SeriesAmountPrompt = {
  templateId: string;
  name: string;
  from: number;
  to: number;
};

type UseSeriesAmountPromptOptions = {
  store: ExpenseStore;
  setSeriesAmount: (templateId: string, amount: number) => void;
};

// "¿Actualizar el importe desde ahora?" tras pagar un recibo con otro importe.
// Solo se pregunta si la serie sigue y el importe pagado es distinto del que
// tendrían los próximos cobros.
export function useSeriesAmountPrompt({
  store,
  setSeriesAmount,
}: UseSeriesAmountPromptOptions) {
  const [prompt, setPrompt] = useState<SeriesAmountPrompt | null>(null);

  function askAfterPayment(templateId: string, paidAmount: number, now = new Date()) {
    const template = store.templates.find((item) => item.id === templateId);
    const today = toDateOnly(now);
    if (!template || !seriesHasUpcomingCharges(template, today)) return false;
    const from = currentSeriesAmount(template, today, store.finance.monthClosures);
    if (from === paidAmount) return false;
    setPrompt({ templateId, name: template.name, from, to: paidAmount });
    return true;
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
