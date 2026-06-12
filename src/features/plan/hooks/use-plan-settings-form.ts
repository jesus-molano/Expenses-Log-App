"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
} from "@/domain/finance";
import type { AppLanguage, FinanceStore, PlanAccount } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

export type PlanSettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
  accounts: PlanAccount[];
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
  const salary = getMonthlySalarySettings(finance, savingsMonthId);
  const [salaryAmount, setSalaryAmount] = useState(
    formatMoneyInput(salary.amount, language),
  );
  const [salaryDay, setSalaryDay] = useState(salary.dayOfMonth);
  const [savingsTarget, setSavingsTarget] = useState(
    formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
  );
  const [accounts, setAccounts] = useState<PlanAccount[]>(finance.accounts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  function resetFromFinance() {
    const currentSalary = getMonthlySalarySettings(finance, savingsMonthId);
    setSalaryAmount(formatMoneyInput(currentSalary.amount, language));
    setSalaryDay(currentSalary.dayOfMonth);
    setSavingsTarget(
      formatMoneyInput(getMonthlySavingsTarget(finance, savingsMonthId), language),
    );
    setAccounts(finance.accounts);
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
      accounts,
    });
    closeSettings();
  }

  return {
    salaryAmount,
    salaryDay,
    savingsTarget,
    accounts,
    settingsOpen,
    dayPickerOpen,
    setSalaryAmount,
    setSalaryDay,
    setSavingsTarget,
    setAccounts,
    setDayPickerOpen,
    openSettings,
    closeSettings,
    submitSettings,
  };
}
