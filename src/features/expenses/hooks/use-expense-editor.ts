"use client";

import { type FormEvent, useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import { currentSeriesAmount } from "@/domain/series-lifecycle";
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
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import {
  type SeriesAmountScope,
  setSeriesAmountInStore,
  updateExpenseTemplateInStore,
} from "@/stores/app/store-commands";
import type { useExpenseStore } from "@/stores/app/use-expense-store";
import { useLeaveGuard } from "./use-leave-guard";

type UseExpenseEditorOptions = {
  template: ExpenseTemplate;
  expenseStore: ReturnType<typeof useExpenseStore>;
  language: AppLanguage;
  now?: Date;
};

export function useExpenseEditor({
  template,
  expenseStore,
  language,
  now = new Date(),
}: UseExpenseEditorOptions) {
  const { store, persist, deleteExpense } = expenseStore;
  // El importe que se edita es el que rige ahora (con sus cambios de precio).
  const currentAmount = currentSeriesAmount(template, toDateOnly(now), store.finance);
  // Valores al abrir: los cambios sin guardar se miden contra ellos.
  const [initialValues, setInitialValues] = useState(() =>
    expenseEditorValues(
      template,
      store.categories.find((item) => item.id === template.categoryId)?.name,
      language,
      currentAmount,
    ),
  );
  const [amountText, setAmountText] = useState(initialValues.amountText);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<DraftExpense>(initialValues.form);

  // Si otra acción de la página cambia el importe o el fin de la serie (pagar
  // con otro importe y actualizarla, finalizar...), el formulario lo refleja
  // mientras ese campo no se haya tocado; si no, guardar lo desharía. Los
  // valores de referencia también cambian: lo que ya está guardado no es un
  // cambio sin guardar.
  const [synced, setSynced] = useState({ amount: currentAmount, endDate: template.endDate });
  if (synced.amount !== currentAmount || synced.endDate !== template.endDate) {
    const nextAmountText = formatMoneyInput(currentAmount, language);
    if (synced.amount !== currentAmount && parseMoneyInput(amountText) === synced.amount) {
      setAmountText(nextAmountText);
    }
    if (synced.endDate !== template.endDate && form.endDate === synced.endDate) {
      setForm({ ...form, endDate: template.endDate });
    }
    setInitialValues({
      amountText: nextAmountText,
      form: { ...initialValues.form, amount: currentAmount, endDate: template.endDate },
    });
    setSynced({ amount: currentAmount, endDate: template.endDate });
  }

  const dirty = hasUnsavedExpenseChanges(
    initialValues,
    { form, amountText },
    template.startDate,
  );
  const leaveGuard = useLeaveGuard(dirty);

  const previewAmount = parseMoneyInput(amountText) ?? 0;
  // Un importe nuevo pregunta desde cuándo vale; lo pasado y lo pagado no
  // cambian nunca.
  const [amountScope, setAmountScope] = useState<SeriesAmountScope>("current");
  const amountChanged = previewAmount > 0 && previewAmount !== currentAmount;

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseMoneyInput(amountText);
    // El campo valida antes de enviar; esto solo protege de un importe vacío.
    if (amount === null || amount <= 0) return;
    const categoryResult = findOrCreateCategory(store, form.categoryName);
    const draft = normalizeEditorDraft(form, template.startDate);
    // Cambiar el importe nunca reescribe lo pagado ni los meses cerrados
    // (`setSeriesAmountInStore` usa `keepAmountBeforeSeriesChange`).
    const withAmount = amountChanged
      ? setSeriesAmountInStore(categoryResult.store, template.id, amount, {
          scope: amountScope,
          today: now,
        })
      : categoryResult.store;

    persist(
      updateExpenseTemplateInStore(withAmount, template.id, {
        name: draft.name || t("expenses.newExpense", language),
        description: draft.description,
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
    amountChanged,
    amountScope,
    setAmountScope,
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
