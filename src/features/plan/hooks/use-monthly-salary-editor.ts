"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { getMonthlySalarySettings } from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

type MonthlySalaryInput = {
  monthId: string;
  salaryAmount: number;
  salaryDay: number;
};

type UseMonthlySalaryEditorOptions = {
  finance: FinanceStore;
  language: AppLanguage;
  monthId: string;
  monthLabel: string;
  onSave: (input: MonthlySalaryInput) => void;
};

export function useMonthlySalaryEditor({
  finance,
  language,
  monthId,
  monthLabel,
  onSave,
}: UseMonthlySalaryEditorOptions) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [salaryDay, setSalaryDay] = useState(28);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  function openEditor() {
    const salary = getMonthlySalarySettings(finance, monthId);
    setAmount(formatMoneyInput(salary.amount, language));
    setSalaryDay(salary.dayOfMonth);
    setDayPickerOpen(false);
    setOpen(true);
  }

  function closeEditor() {
    setDayPickerOpen(false);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      monthId,
      salaryAmount: parseMoneyInput(amount),
      salaryDay,
    });
    closeEditor();
  }

  return {
    open,
    amount,
    salaryDay,
    dayPickerOpen,
    monthLabel,
    setAmount,
    setSalaryDay,
    setDayPickerOpen,
    openEditor,
    closeEditor,
    submit,
  };
}
