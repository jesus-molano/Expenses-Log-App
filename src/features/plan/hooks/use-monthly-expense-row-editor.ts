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
  categoryId?: string;
  categoryName?: string;
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
  const initialCategoryName =
    categories.find((category) => category.id === occurrence.template.categoryId)
      ?.name ?? "General";
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [status, setStatus] = useState<ExpenseOccurrence["status"]>(
    occurrence.status,
  );

  function openEditor() {
    setName(occurrence.template.name);
    setAmount(formatMoneyInput(occurrence.template.amount, language));
    setDueDate(occurrence.dueDate);
    setCategoryName(initialCategoryName);
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
      categoryName,
      status,
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
    setName,
    setAmount,
    setDueDate,
    setCategoryName,
    setStatus,
    openEditor,
    closeEditor: () => setEditing(false),
    save,
  };
}
