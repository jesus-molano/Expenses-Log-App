"use client";

import { useState } from "react";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

export type IncomeEventUpdateInput = {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
};

export function useIncomeEventRowEditor({
  event,
  language,
  onUpdate,
}: {
  event: IncomeEvent;
  language: AppLanguage;
  onUpdate: (input: IncomeEventUpdateInput) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(event.name);
  const [amount, setAmount] = useState(() =>
    formatMoneyInput(event.amount, language),
  );
  const [receivedAt, setReceivedAt] = useState(event.receivedAt);

  function openEditor() {
    setName(event.name);
    setAmount(formatMoneyInput(event.amount, language));
    setReceivedAt(event.receivedAt);
    setEditing(true);
  }

  function save() {
    onUpdate({
      name,
      amount: parseMoneyInput(amount),
      receivedAt,
      note: event.note,
    });
    setEditing(false);
  }

  return {
    editing,
    name,
    amount,
    receivedAt,
    setName,
    setAmount,
    setReceivedAt,
    openEditor,
    closeEditor: () => setEditing(false),
    save,
  };
}
