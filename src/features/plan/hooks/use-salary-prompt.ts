"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  readSalaryPromptDismissedOn,
  writeSalaryPromptDismissedOn,
} from "@/data/persistence/salary-prompt-store";
import { salaryPromptFor } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { SalaryReceiptInput } from "@/stores/app/store-types";

type UseSalaryPromptOptions = {
  finance: FinanceStore;
  now: Date;
  language: AppLanguage;
  recordSalaryReceipt: (input: SalaryReceiptInput) => void;
  onRecorded?: (input: SalaryReceiptInput) => void;
};

// "¿Has cobrado?" el día de cobro: sí (lo previsto), otro importe o "aún no",
// que la esconde en este dispositivo hasta mañana.
export function useSalaryPrompt({
  finance,
  now,
  language,
  recordSalaryReceipt,
  onRecorded,
}: UseSalaryPromptOptions) {
  const today = toDateOnly(now);
  const prompt = useMemo(() => salaryPromptFor(finance, today), [finance, today]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState("");
  const dismissed =
    prompt !== null &&
    (dismissedKey === `${prompt.monthId}@${today}` ||
      readSalaryPromptDismissedOn(prompt.monthId) === today);

  function record(amount: number) {
    if (!prompt) return;
    const input = { monthId: prompt.monthId, amount, receivedOn: today };
    recordSalaryReceipt(input);
    setEditing(false);
    onRecorded?.(input);
  }

  function startOther() {
    if (!prompt) return;
    setAmountText(formatMoneyInput(prompt.expectedAmount, language));
    setEditing(true);
  }

  function saveOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(amountText);
    if (amount === null || amount <= 0) return;
    record(amount);
  }

  function dismiss() {
    if (!prompt) return;
    writeSalaryPromptDismissedOn(prompt.monthId, today);
    setDismissedKey(`${prompt.monthId}@${today}`);
    setEditing(false);
  }

  return {
    prompt: dismissed ? null : prompt,
    editing,
    amountText,
    setAmountText,
    confirm: () => prompt && record(prompt.expectedAmount),
    startOther,
    cancelOther: () => setEditing(false),
    saveOther,
    dismiss,
  };
}
