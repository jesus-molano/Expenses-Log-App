"use client";

import { FormEvent, useState } from "react";
import type {
  AppLanguage,
  CreateExpenseOptions,
  DraftExpense,
  OccurrenceStatus,
} from "@/domain/types";
import { t } from "@/lib/i18n";
import {
  CategoryPicker,
  DayOfMonthPicker,
  ExpenseField,
  formatEuroInput,
  parseEuroInput,
  RecurrencePicker,
  TagPicker,
} from "./ExpenseFormControls";

type ExpenseFormSheetProps = {
  open: boolean;
  draft: DraftExpense;
  language?: AppLanguage;
  onClose: () => void;
  onSave: (draft: DraftExpense, options?: CreateExpenseOptions) => void;
};

export function ExpenseFormSheet({
  open,
  draft,
  language = "es",
  onClose,
  onSave,
}: ExpenseFormSheetProps) {
  const [form, setForm] = useState(draft);
  const [amountText, setAmountText] = useState(() =>
    formatEuroInput(draft.amount, language),
  );
  const [initialStatus, setInitialStatus] =
    useState<Extract<OccurrenceStatus, "due" | "paid">>("due");
  const today = new Date();
  const isPastCurrentMonthDay =
    form.recurrence.frequency !== "yearly" && form.dueDay < today.getDate();

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(
      {
        ...form,
        amount: Math.max(parseEuroInput(amountText), 0.01),
      },
      {
        initialStatus: isPastCurrentMonthDay ? initialStatus : "due",
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <form
        onSubmit={submit}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-white/10 bg-slate-950 shadow-[0_0_60px_rgba(132,204,22,0.12),0_30px_80px_rgba(0,0,0,0.55)] sm:max-w-xl sm:rounded-[1.65rem]"
      >
        <div className="sticky top-0 z-10 bg-slate-950/92 px-5 pb-3 pt-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">
                {t("expenses.newExpense", language)}
              </h2>
              <p className="truncate text-sm text-slate-300">
                {t("expenses.newExpenseSubtitle", language)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 shrink-0 rounded-full px-3 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              {t("expenses.close", language)}
            </button>
          </header>
        </div>

        <div className="grid gap-4 px-5 pb-5">
          <ExpenseField label={t("expenses.name", language)}>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
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
              rows={3}
              className="input-control min-h-24 py-2"
              placeholder={t("expenses.descriptionPlaceholder", language)}
            />
          </ExpenseField>

          <ExpenseField label={t("expenses.amount", language)}>
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              required
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
              value={form.endDate ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  endDate: event.target.value || undefined,
                })
              }
              className="input-control"
              aria-label={t("expenses.endDate", language)}
            />
            <span className="text-xs font-medium text-slate-400">
              {t("expenses.endDateHelp", language)}
            </span>
          </ExpenseField>

          {isPastCurrentMonthDay ? (
            <div className="rounded-[1.15rem] border border-orange-300/20 bg-orange-400/10 p-3">
              <p className="text-sm font-semibold text-orange-100">
                {t("expenses.pastDayTitle", language)}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {t("expenses.pastDayBody", language)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInitialStatus("due")}
                  className={`h-10 rounded-2xl text-sm font-semibold transition ${
                    initialStatus === "due"
                      ? "bg-white text-slate-950"
                      : "bg-white/[0.07] text-white ring-1 ring-white/10"
                  }`}
                >
                  {t("common.pending", language)}
                </button>
                <button
                  type="button"
                  onClick={() => setInitialStatus("paid")}
                  className={`h-10 rounded-2xl text-sm font-semibold transition ${
                    initialStatus === "paid"
                      ? "bg-lime-300 text-slate-950"
                      : "bg-white/[0.07] text-white ring-1 ring-white/10"
                  }`}
                >
                  {t("common.paid", language)}
                </button>
              </div>
            </div>
          ) : null}

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

          <div className="sticky bottom-0 -mx-5 bg-slate-950/92 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
            <button
              type="submit"
              className="h-12 w-full rounded-2xl bg-lime-300 text-base font-semibold text-slate-950 shadow-[0_0_34px_rgba(132,204,22,0.28)] transition hover:bg-lime-200"
            >
              {t("expenses.saveExpense", language)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
