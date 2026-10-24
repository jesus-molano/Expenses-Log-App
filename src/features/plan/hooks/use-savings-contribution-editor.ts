"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  toMonthId,
} from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { MonthlySavingsContributionInput } from "@/stores/app/store-types";

// Hoja "Editar ahorro": la única aportación real de un mes. Se abre desde
// "Ahorro de este mes" en Mes y desde el resumen de un mes.
export function useSavingsContributionEditor({
  finance,
  language,
  onSave,
}: {
  finance: FinanceStore;
  language: AppLanguage;
  onSave: (input: MonthlySavingsContributionInput) => void;
}) {
  const [monthId, setMonthId] = useState<string | null>(null);
  const [actualText, setActualText] = useState("");
  const contribution = monthId ? getMonthlySavingsContribution(finance, monthId) : null;

  function open(nextMonthId: string) {
    const normalized = toMonthId(nextMonthId);
    setMonthId(normalized);
    setActualText(
      formatMoneyInput(getMonthlySavingsContribution(finance, normalized)?.amount ?? 0, language),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!monthId) return;
    const amount = parseMoneyInput(actualText);
    // Solo un 0 escrito borra la aportación; un texto ilegible no guarda nada.
    if (amount === null) return;
    onSave({ monthId, amount });
    setMonthId(null);
  }

  return {
    monthId,
    actualText,
    target: monthId ? getMonthlySavingsTarget(finance, monthId) : 0,
    // Importe heredado sin fecha de transferencia: se avisa en la hoja.
    legacyWithoutDate: contribution?.source === "legacy" && !contribution.transferredAt,
    setActualText,
    open,
    close: () => setMonthId(null),
    submit,
  };
}

export type SavingsContributionEditor = ReturnType<typeof useSavingsContributionEditor>;
