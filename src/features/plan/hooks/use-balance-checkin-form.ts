"use client";

import { type FormEvent, useState } from "react";
import type { AppLanguage } from "@/domain/types";
import type { AccountBalanceInput } from "@/stores/app/account-commands";
import { formatMoneyInput, parseSignedMoneyInput } from "@/shared/money";
import type { AccountSummary } from "../lib/account-summary";

type CheckinForm = {
  accountId: string;
  date: string;
  amountText: string;
  // Lo que se rellenó al abrir o al cambiar de cuenta: si no se ha tocado,
  // cambiar de cuenta lo sustituye por el último saldo de la otra.
  prefill: string;
};

// Hoja de anotar saldo: en qué cuenta, qué día (hoy por defecto) y cuánto.
export function useBalanceCheckinForm({
  summaries,
  today,
  language,
  onRecord,
}: {
  summaries: AccountSummary[];
  // YYYY-MM-DD
  today: string;
  language: AppLanguage;
  onRecord: (input: AccountBalanceInput) => void;
}) {
  const [form, setForm] = useState<CheckinForm | null>(null);
  const entries =
    summaries.find((summary) => summary.account.id === form?.accountId)?.entries ?? [];

  // Parte del último saldo: lo normal es corregirlo, no escribirlo entero.
  function prefillFor(accountId: string) {
    const trend = summaries.find((summary) => summary.account.id === accountId)?.trend;
    return trend ? formatMoneyInput(trend.latest.amount, language) : "";
  }

  function openForm(accountId: string) {
    const prefill = prefillFor(accountId);
    setForm({ accountId, date: today, amountText: prefill, prefill });
  }

  function selectAccount(accountId: string) {
    setForm((current) => {
      if (!current) return current;
      const prefill = prefillFor(accountId);
      return {
        ...current,
        accountId,
        prefill,
        amountText: current.amountText === current.prefill ? prefill : current.amountText,
      };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const amount = parseSignedMoneyInput(form.amountText);
    if (amount === null) return;
    onRecord({ accountId: form.accountId, date: form.date, amount });
    setForm(null);
  }

  return {
    formOpen: form !== null,
    accountId: form?.accountId ?? "",
    date: form?.date ?? today,
    amountText: form?.amountText ?? "",
    // Ya hay un saldo de esa cuenta ese día: guardar lo sustituye.
    replacesEntry: form ? entries.some((entry) => entry.date === form.date) : false,
    setDate: (date: string) => setForm((current) => (current ? { ...current, date } : current)),
    setAmountText: (amountText: string) =>
      setForm((current) => (current ? { ...current, amountText } : current)),
    openForm,
    selectAccount,
    closeForm: () => setForm(null),
    submit,
  };
}
