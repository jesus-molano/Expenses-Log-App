"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMoneyInput, parseSignedMoneyInput } from "@/shared/money";
import {
  activeBalanceEntries,
  balanceTrend,
  type BalanceEntry,
} from "../lib/balance-log";

// Registro de saldo: lo anotado, la tendencia y el formulario para anotar.
export function useBalanceLog({
  finance,
  today,
  language,
  onRecord,
}: {
  finance: FinanceStore;
  // YYYY-MM-DD
  today: string;
  language: AppLanguage;
  onRecord: (entry: BalanceEntry) => void;
}) {
  const entries = useMemo(() => activeBalanceEntries(finance), [finance]);
  const trend = useMemo(() => balanceTrend(entries), [entries]);
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [amountText, setAmountText] = useState("");

  function openForm() {
    setDate(today);
    // Parte del último saldo: lo normal es corregirlo, no escribirlo entero.
    setAmountText(trend ? formatMoneyInput(trend.latest.amount, language) : "");
    setFormOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseSignedMoneyInput(amountText);
    if (amount === null) return;
    onRecord({ date, amount });
    setFormOpen(false);
  }

  return {
    entries,
    trend,
    formOpen,
    date,
    amountText,
    // Ya hay un saldo ese día: guardar lo sustituye.
    replacesEntry: entries.some((entry) => entry.date === date),
    setDate,
    setAmountText,
    openForm,
    closeForm: () => setFormOpen(false),
    submit,
  };
}
