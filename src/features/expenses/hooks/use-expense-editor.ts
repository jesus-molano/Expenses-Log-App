"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_DETAIL_KEYS, sanitizeExpenseDetails } from "@/domain/expense-details";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseTemplate,
} from "@/domain/types";
import {
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import { t } from "@/shared/i18n";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import { updateExpenseTemplateInStore } from "@/stores/app/store-commands";
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
    formatMoneyInput(template.amount, language),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<DraftExpense>(() => ({
    name: template.name,
    description: template.description,
    amount: template.amount,
    // El nombre tal cual: una categoría propia no debe volver a General.
    categoryName: category?.name ?? "General",
    startDate: template.startDate,
    dueDay: template.dueDay,
    endDate: template.endDate,
    recurrence: template.recurrence,
    reminder: template.reminder,
    notes: template.notes,
    cancellationUrl: template.cancellationUrl,
    commitmentEndDate: template.commitmentEndDate,
    paymentMethod: template.paymentMethod,
    paymentMethodDetail: template.paymentMethodDetail,
  }));

  const previewAmount = parseMoneyInput(amountText) ?? 0;

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseMoneyInput(amountText);
    // El campo valida antes de enviar; esto solo protege de un importe vacío.
    if (amount === null || amount <= 0) return;
    const categoryResult = findOrCreateCategory(store, form.categoryName);

    persist(
      updateExpenseTemplateInStore(categoryResult.store, template.id, {
        name: form.name.trim() || t("expenses.newExpense", language),
        description: form.description.trim(),
        amount,
        categoryId: categoryResult.categoryId,
        startDate: form.startDate || template.startDate,
        dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
        endDate: form.endDate || undefined,
        recurrence: form.recurrence,
        reminder: form.reminder,
        // Un dato vaciado se borra (undefined) en lugar de conservar el viejo.
        ...Object.fromEntries(EXPENSE_DETAIL_KEYS.map((key) => [key, undefined])),
        ...sanitizeExpenseDetails(form),
      }),
    );
    // replace: volver atrás desde el listado no debe reabrir el editor.
    router.replace("/");
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
