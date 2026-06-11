"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { formatCurrency } from "@/domain/calendar";
import { resolvePresetCategory } from "@/domain/categories";
import type { AppLanguage, ExpenseTemplate, RecurrenceRule } from "@/domain/types";
import {
  findOrCreateCategory,
  normalizeTags,
} from "@/features/expenses/lib/expense-actions";
import { useExpenseStore } from "@/features/expenses/hooks/use-expense-store";
import { t } from "@/lib/i18n";
import {
  CategoryPicker,
  DayOfMonthPicker,
  ExpenseField,
  formatEuroInput,
  parseEuroInput,
  RecurrencePicker,
  TagPicker,
} from "@/features/expenses/components/ExpenseFormControls";

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
  const router = useRouter();
  const { store, persist, deleteExpense } = expenseStore;
  const category = store.categories.find((item) => item.id === template.categoryId);
  const [amountText, setAmountText] = useState(() =>
    formatEuroInput(template.amount, language),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    name: template.name,
    description: template.description,
    categoryName: resolvePresetCategory(category?.name ?? "General").name,
    dueDay: template.dueDay,
    endDate: template.endDate ?? "",
    recurrence: template.recurrence,
    tags: template.tags,
  }));

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

  function removeExpense() {
    deleteExpense(template.id);
    router.push("/");
  }

  const previewAmount = Math.max(parseEuroInput(amountText), 0);

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
          onSubmit={saveExpense}
          className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-lime-100">
                {localizedRecurrenceLabel(form.recurrence, language)}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold">
                {form.name || template.name}
              </h1>
            </div>
            <p className="shrink-0 text-xl font-semibold">
              {formatCurrency(previewAmount)}
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <ExpenseField label={t("expenses.name", language)}>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="input-control"
                placeholder={t("expenses.namePlaceholder", language)}
              />
            </ExpenseField>

            <ExpenseField label={t("expenses.description", language)}>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="input-control min-h-24 py-2"
                placeholder={t("expenses.descriptionPlaceholder", language)}
              />
            </ExpenseField>

            <ExpenseField label={t("expenses.amount", language)}>
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                className="input-control"
                placeholder={t("expenses.amountPlaceholder", language)}
              />
            </ExpenseField>

            <CategoryPicker
              value={form.categoryName}
              language={language}
              onChange={(categoryName) => setForm({ ...form, categoryName })}
            />

            <DayOfMonthPicker
              value={form.dueDay}
              language={language}
              onChange={(dueDay) => setForm({ ...form, dueDay })}
            />

            <ExpenseField label={t("expenses.endDate", language)}>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm({ ...form, endDate: event.target.value })
                }
                className="input-control"
                aria-label={t("expenses.endDate", language)}
              />
              <span className="text-xs font-medium text-slate-400">
                {t("expenses.endDateHelp", language)}
              </span>
            </ExpenseField>

            <RecurrencePicker
              value={form.recurrence}
              language={language}
              onChange={(recurrence) => setForm({ ...form, recurrence })}
            />

            <TagPicker
              value={form.tags}
              language={language}
              onChange={(tags) => setForm({ ...form, tags })}
            />
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <button className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950">
              {t("expenses.saveChanges", language)}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-400/14 px-4 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20"
            >
              <Trash2 size={17} />
              {t("expenses.delete", language)}
            </button>
          </div>
        </form>
      </div>

      {deleteOpen ? (
        <ConfirmActionDialog
          icon={<Trash2 size={18} />}
          title={t("expenses.delete", language)}
          body={`${t("expenses.deleteConfirm", language)} ${template.name}`}
          cancelLabel={t("common.back", language)}
          confirmLabel={t("expenses.delete", language)}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={removeExpense}
        />
      ) : null}
    </main>
  );
}

function localizedRecurrenceLabel(
  rule: RecurrenceRule,
  language: AppLanguage,
): string {
  if (rule.frequency === "monthly") return t("expenses.monthly", language);
  if (rule.frequency === "quarterly") return t("expenses.quarterly", language);
  if (rule.frequency === "yearly") return t("expenses.yearly", language);
  if (rule.frequency === "custom") return t("expenses.custom", language);
  return rule.frequency.toUpperCase();
}
