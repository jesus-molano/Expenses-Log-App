"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toDateOnly } from "@/domain/calendar";
import { resolvePresetCategory } from "@/domain/categories";
import { currentSeriesAmount } from "@/domain/series-lifecycle";
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
import {
  type SeriesAmountScope,
  setSeriesAmountInStore,
  updateExpenseTemplateInStore,
} from "@/stores/app/store-commands";
import type { useExpenseStore } from "@/stores/app/use-expense-store";

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
  const router = useRouter();
  const { store, persist, deleteExpense } = expenseStore;
  const category = store.categories.find((item) => item.id === template.categoryId);
  // El importe que se edita es el que rige ahora (con sus cambios de precio).
  const currentAmount = currentSeriesAmount(
    template,
    toDateOnly(now),
    store.finance.monthClosures,
  );
  const [amountText, setAmountText] = useState(() =>
    formatMoneyInput(currentAmount, language),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<DraftExpense>(() => ({
    name: template.name,
    description: template.description,
    amount: template.amount,
    categoryName: resolvePresetCategory(category?.name ?? "General").name,
    startDate: template.startDate,
    dueDay: template.dueDay,
    endDate: template.endDate,
    recurrence: template.recurrence,
    reminder: template.reminder,
  }));

  // Si otra acción de la página cambia el importe o el fin de la serie (pagar
  // con otro importe y actualizarla, finalizar...), el formulario lo refleja
  // mientras ese campo no se haya tocado; si no, guardar lo desharía.
  const [synced, setSynced] = useState({ amount: currentAmount, endDate: template.endDate });
  if (synced.amount !== currentAmount || synced.endDate !== template.endDate) {
    if (synced.amount !== currentAmount && parseMoneyInput(amountText) === synced.amount) {
      setAmountText(formatMoneyInput(currentAmount, language));
    }
    if (synced.endDate !== template.endDate && form.endDate === synced.endDate) {
      setForm({ ...form, endDate: template.endDate });
    }
    setSynced({ amount: currentAmount, endDate: template.endDate });
  }

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
    const withAmount = amountChanged
      ? setSeriesAmountInStore(categoryResult.store, template.id, amount, {
          scope: amountScope,
          today: now,
        })
      : categoryResult.store;

    persist(
      updateExpenseTemplateInStore(withAmount, template.id, {
        name: form.name.trim() || t("expenses.newExpense", language),
        description: form.description.trim(),
        categoryId: categoryResult.categoryId,
        startDate: form.startDate || template.startDate,
        dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
        endDate: form.endDate || undefined,
        recurrence: form.recurrence,
        reminder: form.reminder,
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
    amountChanged,
    amountScope,
    setAmountScope,
    deleteOpen,
    setForm,
    setAmountText,
    setDeleteOpen,
    saveExpense,
    removeExpense,
  };
}
