"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { getMonthlySavingsTarget } from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

type MonthlySavingsTargetInput = {
  monthId: string;
  savingsTarget: number;
};

type UseMonthlySavingsTargetEditorOptions = {
  finance: FinanceStore;
  language: AppLanguage;
  monthId: string;
  monthLabel: string;
  onSave: (input: MonthlySavingsTargetInput) => void;
};

export function useMonthlySavingsTargetEditor({
  finance,
  language,
  monthId,
  monthLabel,
  onSave,
}: UseMonthlySavingsTargetEditorOptions) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  function openEditor() {
    setAmount(
      formatMoneyInput(getMonthlySavingsTarget(finance, monthId), language),
    );
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      monthId,
      savingsTarget: parseMoneyInput(amount),
    });
    closeEditor();
  }

  return {
    open,
    amount,
    monthLabel,
    setAmount,
    openEditor,
    closeEditor,
    submit,
  };
}
