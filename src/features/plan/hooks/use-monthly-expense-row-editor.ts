"use client";

import { useState } from "react";
import { paidAmount as paidAmountOf } from "@/domain/finance";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";

export type MonthlyExpenseUpdateInput = {
  templateId: string;
  occurrenceDate: string;
  dueDate: string;
  name: string;
  amount: number;
  categoryId?: string;
  categoryName?: string;
  status: ExpenseOccurrence["status"];
  // Lo pagado de verdad (recibos variables); lo previsto es `amount`.
  amountPaid?: number;
};

export function useMonthlyExpenseRowEditor({
  occurrence,
  categories,
  language,
  onUpdate,
}: {
  occurrence: ExpenseOccurrence;
  categories: ExpenseCategory[];
  language: AppLanguage;
  onUpdate: (input: MonthlyExpenseUpdateInput) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(occurrence.template.name);
  const [amount, setAmount] = useState(() =>
    formatMoneyInput(occurrence.template.amount, language),
  );
  const [dueDate, setDueDate] = useState(occurrence.dueDate);
  const initialCategoryName =
    categories.find((category) => category.id === occurrence.template.categoryId)
      ?.name ?? "General";
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [status, setStatus] = useState<ExpenseOccurrence["status"]>(
    occurrence.status,
  );
  const initialPaidAmount = () =>
    formatMoneyInput(
      occurrence.status === "paid" ? paidAmountOf(occurrence) : occurrence.template.amount,
      language,
    );
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount);

  function openEditor() {
    setName(occurrence.template.name);
    setAmount(formatMoneyInput(occurrence.template.amount, language));
    setDueDate(occurrence.dueDate);
    setCategoryName(initialCategoryName);
    setStatus(occurrence.status);
    setPaidAmount(initialPaidAmount());
    setEditing(true);
  }

  function save() {
    const parsedAmount = parseMoneyInput(amount);
    if (parsedAmount === null || parsedAmount <= 0) return;
    const parsedPaid = status === "paid" ? parseMoneyInput(paidAmount) : null;
    if (status === "paid" && (parsedPaid === null || parsedPaid <= 0)) return;
    onUpdate({
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      dueDate,
      name,
      amount: parsedAmount,
      categoryName,
      status,
      amountPaid: parsedPaid ?? undefined,
    });
    setEditing(false);
  }

  return {
    editing,
    name,
    amount,
    dueDate,
    status,
    categoryName,
    paidAmount,
    setName,
    setPaidAmount,
    setAmount,
    setDueDate,
    setCategoryName,
    setStatus,
    openEditor,
    closeEditor: () => setEditing(false),
    save,
  };
}
