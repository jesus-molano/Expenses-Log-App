"use client";

import { type FormEvent, useState } from "react";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseTemplate,
} from "@/domain/types";
import {
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import {
  expenseEditorValues,
  hasUnsavedExpenseChanges,
  normalizeEditorDraft,
} from "@/features/expenses/lib/expense-editor";
import { t } from "@/shared/i18n";
import { parseMoneyInput } from "@/shared/money";
import { updateExpenseTemplateInStore } from "@/stores/app/store-commands";
import type { useExpenseStore } from "@/stores/app/use-expense-store";
import { useLeaveGuard } from "./use-leave-guard";

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
  const { store, persist, deleteExpense } = expenseStore;
  // Valores al abrir: los cambios sin guardar se miden contra ellos.
  const [initialValues] = useState(() =>
    expenseEditorValues(
      template,
      store.categories.find((item) => item.id === template.categoryId)?.name,
      language,
    ),
  );
  const [amountText, setAmountText] = useState(initialValues.amountText);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<DraftExpense>(initialValues.form);
  const dirty = hasUnsavedExpenseChanges(
    initialValues,
    { form, amountText },
    template.startDate,
  );
  const leaveGuard = useLeaveGuard(dirty);

  const previewAmount = parseMoneyInput(amountText) ?? 0;

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseMoneyInput(amountText);
    // El campo valida antes de enviar; esto solo protege de un importe vacío.
    if (amount === null || amount <= 0) return;
    const categoryResult = findOrCreateCategory(store, form.categoryName);
    const draft = normalizeEditorDraft(form, template.startDate);

    persist(
      updateExpenseTemplateInStore(categoryResult.store, template.id, {
        name: draft.name || t("expenses.newExpense", language),
        description: draft.description,
        amount,
        categoryId: categoryResult.categoryId,
        startDate: draft.startDate,
        dueDay: draft.dueDay,
        endDate: draft.endDate,
        recurrence: draft.recurrence,
        reminder: draft.reminder,
      }),
    );
    // replace: volver atrás desde el listado no debe reabrir el editor.
    leaveGuard.leaveToList();
  }

  function removeExpense() {
    setDeleteOpen(false);
    // Se borra al salir: la nube se sincroniza sin esperar en esta pantalla.
    leaveGuard.leaveToList(() => void deleteExpense(template.id));
  }

  return {
    form,
    amountText,
    previewAmount,
    deleteOpen,
    discardPromptOpen: leaveGuard.discardPromptOpen,
    setForm,
    setAmountText,
    setDeleteOpen,
    saveExpense,
    removeExpense,
    requestLeave: leaveGuard.requestLeave,
    discardChanges: leaveGuard.discardChanges,
    keepEditing: leaveGuard.keepEditing,
  };
}
