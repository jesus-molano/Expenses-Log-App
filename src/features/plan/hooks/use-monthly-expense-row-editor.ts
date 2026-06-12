"use client";

import { useState } from "react";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";

export type MonthlyExpenseUpdateInput = {
  templateId: string;
  occurrenceDate: string;
  dueDate: string;
  name: string;
  amount: number;
  categoryId: string;
  status: ExpenseOccurrence["status"];
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
  const [categoryId, setCategoryId] = useState(occurrence.template.categoryId);
  const [status, setStatus] = useState<ExpenseOccurrence["status"]>(
    occurrence.status,
  );
  const categoryName =
    categories.find((category) => category.id === occurrence.template.categoryId)
      ?.name ?? "General";

  function openEditor() {
    setName(occurrence.template.name);
    setAmount(formatMoneyInput(occurrence.template.amount, language));
    setDueDate(occurrence.dueDate);
    setCategoryId(occurrence.template.categoryId);
    setStatus(occurrence.status);
    setEditing(true);
  }

  function save() {
    onUpdate({
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      dueDate,
      name,
      amount: parseMoneyInput(amount),
      categoryId,
      status,
    });
    setEditing(false);
  }

  return {
    editing,
    name,
    amount,
    dueDate,
    categoryId,
    status,
    categoryName,
    setName,
    setAmount,
    setDueDate,
    setCategoryId,
    setStatus,
    openEditor,
    closeEditor: () => setEditing(false),
    save,
  };
}
