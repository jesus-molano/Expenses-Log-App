"use client";

import { type FormEvent, useState } from "react";
import { addMonthId, resolveActiveMonth } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseAmountChange,
  ExpenseTemplate,
  FinanceStore,
} from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";

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
// se cambia editando el importe) y el nuevo precio rige desde su día 1.
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
  const activeMonthId = resolveActiveMonth(toDateOnly(now), finance.monthClosures);
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
    scheduleAmountChange(template.id, { from: `${monthId}-01`, amount });
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
