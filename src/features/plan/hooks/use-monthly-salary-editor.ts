"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { getMonthlySalarySettings, toMonthId } from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { MonthlySalaryInput, SalaryScope } from "@/stores/app/store-types";

type UseMonthlySalaryEditorOptions = {
  finance: FinanceStore;
  language: AppLanguage;
  monthId: string;
  monthLabel: string;
  // Mes activo (el natural, o el siguiente si el natural está cerrado):
  // editar un mes ya registrado propone "Solo este mes".
  activeMonthId: string;
  onSave: (input: MonthlySalaryInput) => void;
};

export function useMonthlySalaryEditor({
  finance,
  language,
  monthId,
  monthLabel,
  activeMonthId,
  onSave,
}: UseMonthlySalaryEditorOptions) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [salaryDay, setSalaryDay] = useState(28);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  // M16: un sueldo distinto un mes (paga extra, horas extra) no debe
  // arrastrarse a los siguientes sin preguntar.
  const [scope, setScope] = useState<SalaryScope>("fromMonth");

  function openEditor() {
    const salary = getMonthlySalarySettings(finance, monthId);
    setAmount(formatMoneyInput(salary.amount, language));
    setSalaryDay(salary.dayOfMonth);
    setScope(toMonthId(monthId) < activeMonthId ? "month" : "fromMonth");
    setDayPickerOpen(false);
    setOpen(true);
  }

  function closeEditor() {
    setDayPickerOpen(false);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salaryAmount = parseMoneyInput(amount);
    if (salaryAmount === null) return;
    onSave({
      monthId,
      salaryAmount,
      salaryDay,
      scope,
    });
    closeEditor();
  }

  return {
    open,
    amount,
    salaryDay,
    dayPickerOpen,
    monthLabel,
    scope,
    setScope,
    setAmount,
    setSalaryDay,
    setDayPickerOpen,
    openEditor,
    closeEditor,
    submit,
  };
}
