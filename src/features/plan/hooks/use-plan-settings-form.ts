"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
  getSalaryExtraPaySettings,
} from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { SalaryExtraPayInput } from "@/stores/app/store-types";

export type PlanSettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
};

export function usePlanSettingsForm({
  finance,
  language,
  savingsMonthId,
  onSave,
  onSaveExtraPay,
}: {
  finance: FinanceStore;
  language: AppLanguage;
  savingsMonthId: string;
  onSave: (input: PlanSettingsInput) => void;
  // Pagas extra, vigentes desde el mismo mes que el resto de ajustes.
  onSaveExtraPay?: (input: SalaryExtraPayInput) => void;
}) {
  const salary = getMonthlySalarySettings(finance, savingsMonthId);
  const [salaryAmount, setSalaryAmount] = useState(
    formatMoneyInput(salary.amount, language),
  );
  const [salaryDay, setSalaryDay] = useState(salary.dayOfMonth);
  const [savingsTarget, setSavingsTarget] = useState(
    formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [extraPayMonths, setExtraPayMonths] = useState<number[]>([]);
  const [extraPayAmount, setExtraPayAmount] = useState("");

  function resetFromFinance() {
    const currentSalary = getMonthlySalarySettings(finance, savingsMonthId);
    const extraPay = getSalaryExtraPaySettings(finance, savingsMonthId);
    setSalaryAmount(formatMoneyInput(currentSalary.amount, language));
    setSalaryDay(currentSalary.dayOfMonth);
    setSavingsTarget(
      formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
    );
    setExtraPayMonths(extraPay?.months ?? []);
    setExtraPayAmount(
      extraPay?.amount !== undefined ? formatMoneyInput(extraPay.amount, language) : "",
    );
    setDayPickerOpen(false);
  }

  function toggleExtraPayMonth(month: number) {
    setExtraPayMonths((months) =>
      months.includes(month)
        ? months.filter((item) => item !== month)
        : [...months, month].sort((a, b) => a - b),
    );
  }

  function openSettings() {
    resetFromFinance();
    setSettingsOpen(true);
  }

  function closeSettings() {
    setDayPickerOpen(false);
    setSettingsOpen(false);
  }

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salary = parseMoneyInput(salaryAmount);
    const target = parseMoneyInput(savingsTarget);
    // El importe de la paga extra es opcional: vacío es un sueldo más.
    const extraAmount = extraPayAmount.trim() ? parseMoneyInput(extraPayAmount) : undefined;
    if (salary === null || target === null || extraAmount === null) return;
    onSave({
      salaryAmount: salary,
      salaryDay,
      savingsMonthId,
      savingsTarget: target,
    });
    onSaveExtraPay?.({
      monthId: savingsMonthId,
      months: extraPayMonths,
      amount: extraAmount && extraAmount > 0 ? extraAmount : undefined,
    });
    closeSettings();
  }

  return {
    salaryAmount,
    salaryDay,
    savingsTarget,
    settingsOpen,
    dayPickerOpen,
    extraPayMonths,
    extraPayAmount,
    toggleExtraPayMonth,
    setExtraPayAmount,
    setSalaryAmount,
    setSalaryDay,
    setSavingsTarget,
    setDayPickerOpen,
    openSettings,
    closeSettings,
    submitSettings,
  };
}
