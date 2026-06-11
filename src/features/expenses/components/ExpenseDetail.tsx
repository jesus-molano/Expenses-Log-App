"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
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

export function ExpenseDetail({ id }: { id: string }) {
  const expenseStore = useExpenseStore();
  const template = expenseStore.store.templates.find((item) => item.id === id);
  const language = expenseStore.store.preferences?.language ?? "es";

  if (!expenseStore.isHydrated) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-center text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <p className="font-semibold">
            {t("expenses.loadingExpense", language)}
          </p>
        </div>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-center text-white">
        <div>
          <p className="font-semibold">
            {t("expenses.expenseNotFound", language)}
          </p>
          <Link className="mt-3 inline-block text-sm text-slate-300" href="/">
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
    <main className="app-page-bg min-h-dvh px-4 py-5 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/10"
        >
          <ArrowLeft size={18} />
          {t("expenses.expensesBack", language)}
        </Link>

        <form
          onSubmit={editor.saveExpense}
          className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-lime-100">
                {localizedRecurrenceLabel(editor.form.recurrence, language)}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold">
                {editor.form.name || template.name}
              </h1>
            </div>
            <p className="shrink-0 text-xl font-semibold">
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
            <button className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950">
              {t("expenses.saveChanges", language)}
            </button>
            <button
              type="button"
              onClick={() => editor.setDeleteOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-400/14 px-4 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20"
            >
              <Trash2 size={17} />
              {t("expenses.delete", language)}
            </button>
          </div>
        </form>
      </div>

      {editor.deleteOpen ? (
        <ConfirmActionDialog
          icon={<Trash2 size={18} />}
          title={t("expenses.delete", language)}
          body={`${t("expenses.deleteConfirm", language)} ${template.name}`}
          cancelLabel={t("common.back", language)}
          confirmLabel={t("expenses.delete", language)}
          onCancel={() => editor.setDeleteOpen(false)}
          onConfirm={editor.removeExpense}
        />
      ) : null}
    </main>
  );
}


