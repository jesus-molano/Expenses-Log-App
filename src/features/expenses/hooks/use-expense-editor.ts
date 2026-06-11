"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePresetCategory } from "@/domain/categories";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseTemplate,
} from "@/domain/types";
import {
  findOrCreateCategory,
  normalizeTags,
} from "@/features/expenses/lib/expense-actions";
import {
  formatEuroInput,
  parseEuroInput,
} from "@/features/expenses/components/ExpenseFormControls";
import { t } from "@/shared/i18n";
import type { useExpenseStore } from "@/stores/app/use-expense-store";

type UseExpenseEditorOptions = {
  template: ExpenseTemplate;
  expenseStore: ReturnType<typeof useExpenseStore>;
  language: AppLanguage;
};

export function useExpenseEditor({
  template,
  expenseStore,
  language,
}: UseExpenseEditorOptions) {
  const router = useRouter();
  const { store, persist, deleteExpense } = expenseStore;
  const category = store.categories.find((item) => item.id === template.categoryId);
  const [amountText, setAmountText] = useState(() =>
    formatEuroInput(template.amount, language),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<DraftExpense>(() => ({
    name: template.name,
    description: template.description,
    amount: template.amount,
    categoryName: resolvePresetCategory(category?.name ?? "General").name,
    dueDay: template.dueDay,
    endDate: template.endDate,
    recurrence: template.recurrence,
    tags: template.tags,
  }));

  const previewAmount = Math.max(parseEuroInput(amountText), 0);

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryResult = findOrCreateCategory(store, form.categoryName);
    const amount = Math.max(parseEuroInput(amountText), 0.01);

    persist({
      ...categoryResult.store,
      templates: categoryResult.store.templates.map((item) =>
        item.id === template.id
          ? {
              ...item,
              name: form.name.trim() || t("expenses.newExpense", language),
              description: form.description.trim(),
              amount,
              categoryId: categoryResult.categoryId,
              dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
              endDate: form.endDate || undefined,
              recurrence: form.recurrence,
              tags: normalizeTags(form.tags.join(",")),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
    router.push("/");
  }

  async function removeExpense() {
    await deleteExpense(template.id);
    setDeleteOpen(false);
    router.replace("/");
  }

  return {
    form,
    amountText,
    previewAmount,
    deleteOpen,
    setForm,
    setAmountText,
    setDeleteOpen,
    saveExpense,
    removeExpense,
  };
}
