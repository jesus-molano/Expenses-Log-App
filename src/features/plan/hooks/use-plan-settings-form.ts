"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

export type PlanSettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsTarget: number;
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

export function usePlanSettingsForm({
  finance,
  language,
  onSave,
}: {
  finance: FinanceStore;
  language: AppLanguage;
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
    formatMoneyInput(finance.allocation.monthlySavingsTarget, language),
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
      formatMoneyInput(finance.allocation.monthlySavingsTarget, language),
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
