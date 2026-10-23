"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseTemplate,
} from "@/domain/types";
import { useExpenseEditor } from "@/features/expenses/hooks/use-expense-editor";
import { localizedRecurrenceLabel } from "@/features/expenses/lib/recurrence-label";
import type { SeriesAmountScope } from "@/stores/app/store-commands";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { t } from "@/shared/i18n";
import { ExpenseContractSummary } from "@/features/expenses/components/ExpenseContractSummary";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";

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

function AmountScopeChoice({
  scope,
  language,
  onChange,
}: {
  scope: SeriesAmountScope;
  language: AppLanguage;
  onChange: (scope: SeriesAmountScope) => void;
}) {
  return (
    <fieldset className="app-section-card mt-4 border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] p-3">
      <legend className="sr-only">{t("expenses.amountScopeTitle", language)}</legend>
      <p className="text-sm font-semibold text-[var(--app-text)]">
        {t("expenses.amountScopeTitle", language)}
      </p>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {t("expenses.amountScopeBody", language)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["current", "next"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            className="h-auto min-h-10 py-2"
            variant={scope === option ? "primary" : "secondary"}
            aria-pressed={scope === option}
            onClick={() => onChange(option)}
          >
            {t(option === "current" ? "expenses.amountScopeCurrent" : "expenses.amountScopeNext", language)}
          </Button>
        ))}
      </div>
    </fieldset>
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
  const today = toDateOnly(useCurrentDate());

  return (
    <main className="app-page app-page-safe min-h-dvh px-4">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="app-button app-button-secondary app-button-sm inline-flex"
        >
          <ArrowLeft size={18} />
          {t("expenses.expensesBack", language)}
        </Link>

        <form
          onSubmit={editor.saveExpense}
          className="app-section-card mt-4 p-5"
        >
          {/* Si el nombre no cabe junto al importe, el importe baja a su propia
              linea en vez de recortar el nombre. */}
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 max-w-full">
              <p className="break-words text-sm font-medium text-[var(--app-accent)]">
                {localizedRecurrenceLabel(editor.form.recurrence, language)}
              </p>
              <h1 className="mt-1 break-words text-3xl font-semibold text-[var(--app-text)]">
                {editor.form.name || template.name}
              </h1>
            </div>
            <p className="app-money shrink-0 whitespace-nowrap text-xl font-semibold text-[var(--app-text)]">
              {formatCurrency(editor.previewAmount)}
            </p>
          </div>

          <ExpenseContractSummary template={template} today={today} language={language} />

          <div className="mt-5">
            <ExpenseForm
              form={editor.form}
              amountText={editor.amountText}
              language={language}
              categories={expenseStore.store.categories}
              onCreateCategory={expenseStore.createCategory}
              onFormChange={editor.setForm}
              onAmountTextChange={editor.setAmountText}
            />
          </div>

          {editor.amountChanged ? (
            <AmountScopeChoice
              scope={editor.amountScope}
              language={language}
              onChange={editor.setAmountScope}
            />
          ) : null}

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

