"use client";

import { type FormEvent, useState } from "react";
import { activeBudgetMonth, addMonthId } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseAmountChange,
  ExpenseTemplate,
  FinanceStore,
} from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import { priceChangeStart } from "@/features/expenses/lib/price-change";

// Meses que se ofrecen para un cambio de precio programado.
const PRICE_CHANGE_MONTHS = 12;

type UsePriceChangeSheetOptions = {
  template: ExpenseTemplate;
  currentAmount: number;
  finance: FinanceStore;
  now: Date;
  language: AppLanguage;
  scheduleAmountChange: (templateId: string, change: ExpenseAmountChange) => void;
};

// "Desde marzo cuesta 15 €": se elige un mes posterior al activo (el activo
// se cambia editando el importe) y el nuevo precio rige desde el primer día
// de ese mes de presupuesto (el día de cobro con el ciclo anclado al cobro).
export function usePriceChangeSheet({
  template,
  currentAmount,
  finance,
  now,
  language,
  scheduleAmountChange,
}: UsePriceChangeSheetOptions) {
  const [open, setOpen] = useState(false);
  const [monthId, setMonthId] = useState("");
  const [amountText, setAmountText] = useState("");
  // El mes activo, con el ciclo del presupuesto (el mismo que en Gastos).
  const activeMonthId = activeBudgetMonth(finance, toDateOnly(now)).monthId;
  const monthChoices = Array.from({ length: PRICE_CHANGE_MONTHS }, (_, index) =>
    addMonthId(activeMonthId, index + 1),
  );

  function openSheet() {
    setMonthId(monthChoices[0]);
    setAmountText(formatMoneyInput(currentAmount, language));
    setOpen(true);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(amountText);
    if (amount === null || amount <= 0 || !monthId) return;
    scheduleAmountChange(template.id, { from: priceChangeStart(monthId, finance), amount });
    setOpen(false);
  }

  return {
    open,
    monthId,
    monthChoices,
    amountText,
    setMonthId,
    setAmountText,
    openSheet,
    close: () => setOpen(false),
    save,
  };
}
