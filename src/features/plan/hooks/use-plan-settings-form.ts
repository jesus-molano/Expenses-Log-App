"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { getMonthlySavingsTarget } from "@/domain/finance";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

export type PlanSettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

export function usePlanSettingsForm({
  finance,
  language,
  savingsMonthId,
  onSave,
}: {
  finance: FinanceStore;
  language: AppLanguage;
  savingsMonthId: string;
  onSave: (input: PlanSettingsInput) => void;
}) {
  const salary = finance.incomeSources.find(
    (source) => source.id === "inc-salary",
  );
  const [salaryAmount, setSalaryAmount] = useState(
    formatMoneyInput(salary?.amount ?? 0, language),
  );
  const [salaryDay, setSalaryDay] = useState(salary?.dayOfMonth ?? 28);
  const [savingsTarget, setSavingsTarget] = useState(
    formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
  );
  const [accountNames, setAccountNames] = useState({
    expensesAccountName: finance.allocation.expensesAccountName,
    savingsAccountName: finance.allocation.savingsAccountName,
    primaryAccountName: finance.allocation.primaryAccountName,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  function resetFromFinance() {
    setSalaryAmount(formatMoneyInput(salary?.amount ?? 0, language));
    setSalaryDay(salary?.dayOfMonth ?? 28);
    setSavingsTarget(
      formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
    );
    setAccountNames({
      expensesAccountName: finance.allocation.expensesAccountName,
      savingsAccountName: finance.allocation.savingsAccountName,
      primaryAccountName: finance.allocation.primaryAccountName,
    });
    setDayPickerOpen(false);
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
    onSave({
      salaryAmount: parseMoneyInput(salaryAmount),
      salaryDay,
      savingsMonthId,
      savingsTarget: parseMoneyInput(savingsTarget),
      ...accountNames,
    });
    closeSettings();
  }

  return {
    salaryAmount,
    salaryDay,
    savingsTarget,
    accountNames,
    settingsOpen,
    dayPickerOpen,
    setSalaryAmount,
    setSalaryDay,
    setSavingsTarget,
    setAccountNames,
    setDayPickerOpen,
    openSettings,
    closeSettings,
    submitSettings,
  };
}
