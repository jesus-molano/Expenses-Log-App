"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseTemplate,
} from "@/domain/types";
import { useExpenseEditor } from "@/features/expenses/hooks/use-expense-editor";
import { localizedRecurrenceLabel } from "@/features/expenses/lib/recurrence-label";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { t } from "@/shared/i18n";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { ExpenseDetailDialogs } from "@/features/expenses/components/ExpenseDetailDialogs";

export function ExpenseDetail({ id }: { id: string }) {
  const expenseStore = useExpenseStore();
  const template = expenseStore.store.templates.find((item) => item.id === id);
  const language = expenseStore.store.preferences?.language ?? "es";

  if (!expenseStore.isHydrated) {
    return (
      <main className="app-page app-page-safe grid min-h-dvh place-items-center px-6 text-center">
        <div className="app-section-card px-6 py-5">
          <p className="font-semibold text-[var(--app-text)]">
            {t("expenses.loadingExpense", language)}
          </p>
        </div>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="app-page app-page-safe grid min-h-dvh place-items-center px-6 text-center">
        <div className="app-section-card p-5">
          <p className="font-semibold text-[var(--app-text)]">
            {t("expenses.expenseNotFound", language)}
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-[var(--app-accent)]"
            href="/"
          >
            {t("common.back", language)}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <ExpenseDetailForm
      key={template.id}
      template={template}
      expenseStore={expenseStore}
      language={language}
    />
  );
}

function ExpenseDetailForm({
  template,
  expenseStore,
  language,
}: {
  template: ExpenseTemplate;
  expenseStore: ReturnType<typeof useExpenseStore>;
  language: AppLanguage;
}) {
  const editor = useExpenseEditor({ template, expenseStore, language });

  return (
    <main className="app-page app-page-safe min-h-dvh px-4">
      <div className="mx-auto max-w-2xl">
        {/* Vuelve atrás en el historial (a la lista); con cambios sin guardar,
            pregunta antes. */}
        <Link
          href="/"
          onClick={(event) => {
            // Con Ctrl/Cmd/Mayús, el navegador abre la lista en otra pestaña.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            editor.requestLeave();
          }}
          className="app-button app-button-secondary app-button-sm inline-flex"
        >
          <ArrowLeft size={18} />
          {t("expenses.expensesBack", language)}
        </Link>

        <form
          onSubmit={editor.saveExpense}
          className="app-section-card mt-4 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--app-accent)]">
                {localizedRecurrenceLabel(editor.form.recurrence, language)}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold text-[var(--app-text)]">
                {editor.form.name || template.name}
              </h1>
            </div>
            <p className="app-money shrink-0 text-xl font-semibold text-[var(--app-text)]">
              {formatCurrency(editor.previewAmount)}
            </p>
          </div>

          <div className="mt-5">
            <ExpenseForm
              form={editor.form}
              amountText={editor.amountText}
              language={language}
              onFormChange={editor.setForm}
              onAmountTextChange={editor.setAmountText}
            />
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <Button type="submit">
              {t("expenses.saveChanges", language)}
            </Button>
            <Button
              type="button"
              variant="danger"
              leadingIcon={<Trash2 size={17} />}
              onClick={() => editor.setDeleteOpen(true)}
            >
              {t("expenses.delete", language)}
            </Button>
          </div>
        </form>
      </div>

      <ExpenseDetailDialogs
        expenseName={template.name}
        language={language}
        deleteOpen={editor.deleteOpen}
        discardOpen={editor.discardPromptOpen}
        onCancelDelete={() => editor.setDeleteOpen(false)}
        onConfirmDelete={editor.removeExpense}
        onKeepEditing={editor.keepEditing}
        onDiscardChanges={editor.discardChanges}
      />
    </main>
  );
}

