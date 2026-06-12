"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type {
  AppLanguage,
  CreateExpenseOptions,
  DraftExpense,
  OccurrenceStatus,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { ExpenseForm } from "./ExpenseForm";
import {
  formatEuroInput,
  parseEuroInput,
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
  const startDate = form.startDate
    ? new Date(`${form.startDate}T00:00:00`)
    : today;
  const isPastCurrentMonthDay =
    startDate.getFullYear() === today.getFullYear() &&
    startDate.getMonth() === today.getMonth() &&
    startDate.getDate() < today.getDate();

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
    <Sheet
      ariaLabel={t("expenses.newExpense", language)}
      onBackdropClick={onClose}
    >
      <form onSubmit={submit} className="contents">
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("expenses.newExpense", language)}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("expenses.newExpenseSubtitle", language)}
              </p>
            </div>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-full"
            >
              {t("expenses.close", language)}
            </Button>
          </header>
        </div>

        <div className="grid gap-4 px-5 pb-5">
          <ExpenseForm
            form={form}
            amountText={amountText}
            language={language}
            onFormChange={setForm}
            onAmountTextChange={setAmountText}
          />

          {isPastCurrentMonthDay ? (
            <div className="app-section-card border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] p-3">
              <p className="text-sm font-semibold text-[var(--app-warning)]">
                {t("expenses.pastDayTitle", language)}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {t("expenses.pastDayBody", language)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => setInitialStatus("due")}
                  variant={initialStatus === "due" ? "primary" : "secondary"}
                  size="sm"
                  className="h-10"
                >
                  {t("common.pending", language)}
                </Button>
                <Button
                  type="button"
                  onClick={() => setInitialStatus("paid")}
                  variant={initialStatus === "paid" ? "primary" : "secondary"}
                  size="sm"
                  className="h-10"
                >
                  {t("common.paid", language)}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="app-sheet-footer sticky bottom-0 -mx-5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              type="submit"
              className="w-full"
              variant="primary"
              size="lg"
            >
              {t("expenses.saveExpense", language)}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
