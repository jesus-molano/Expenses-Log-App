"use client";

import { useState } from "react";
import { type ChargeChoice, endChargeChoices } from "@/domain/series-lifecycle";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";

type UseEndSeriesSheetOptions = {
  store: ExpenseStore;
  template: ExpenseTemplate;
  now: Date;
  endSeries: (templateId: string, lastChargeDate: string) => void;
};

// "Finalizar": se elige el último cobro entre el del mes pasado y los
// siguientes (nunca antes de uno pagado). Por defecto, el primero pendiente.
export function useEndSeriesSheet({ store, template, now, endSeries }: UseEndSeriesSheetOptions) {
  const [choices, setChoices] = useState<ChargeChoice[] | null>(null);
  const [selected, setSelected] = useState("");

  function openSheet() {
    const next = endChargeChoices(store, template, now);
    setChoices(next);
    setSelected(next.find((choice) => !choice.paid)?.date ?? next.at(-1)?.date ?? "");
  }

  function confirm() {
    if (!selected) return;
    endSeries(template.id, selected);
    setChoices(null);
  }

  return {
    open: choices !== null,
    choices: choices ?? [],
    selected,
    setSelected,
    openSheet,
    close: () => setChoices(null),
    confirm,
  };
}
