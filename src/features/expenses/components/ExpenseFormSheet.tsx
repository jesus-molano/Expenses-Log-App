"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { toDateOnly } from "@/domain/calendar";
import type { CategoryInput } from "@/domain/categories";
import type { CapturedDraft } from "@/domain/expense-capture";
import { firstChargeAlreadyPassed } from "@/domain/recurrence";
import type {
  AppLanguage,
  CreateExpenseOptions,
  DraftExpense,
  ExpenseCategory,
  OccurrenceStatus,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import { inferredFieldsLabel, type CaptureReason } from "../lib/capture-labels";
import { CaptureNotice } from "./CaptureNotice";
import { ExpenseForm } from "./ExpenseForm";

type ExpenseFormSheetProps = {
  open: boolean;
  draft: DraftExpense;
  // Lo que la captura con IA no encontró o dedujo, para revisarlo.
  review?: Pick<CapturedDraft, "missingFields" | "inferredFields"> | null;
  // Por qué el borrador viene del análisis local, si es el caso.
  notice?: CaptureReason | null;
  language?: AppLanguage;
  categories?: ExpenseCategory[];
  onCreateCategory?: (input: CategoryInput) => string | null;
  onClose: () => void;
  onSave: (draft: DraftExpense, options?: CreateExpenseOptions) => void;
};

export function ExpenseFormSheet({
  open,
  draft,
  review = null,
  notice = null,
  language = "es",
  categories,
  onCreateCategory,
  onClose,
  onSave,
}: ExpenseFormSheetProps) {
  const [form, setForm] = useState(draft);
  // Sin importe (captura que no lo encontró), el campo empieza vacío.
  const [amountText, setAmountText] = useState(() =>
    draft.amount > 0 ? formatMoneyInput(draft.amount, language) : "",
  );
  const toReview = inferredFieldsLabel(review?.inferredFields ?? [], language);
  const [initialStatus, setInitialStatus] =
    useState<Extract<OccurrenceStatus, "due" | "paid">>("due");
  // Se pregunta por el primer cobro real, no por la fecha de inicio: un
  // mensual que empieza el día 1 y se cobra el 25 aún no ha pasado el 23.
  const isPastCurrentMonthDay = firstChargeAlreadyPassed(form, toDateOnly(new Date()));

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(amountText);
    // El campo valida antes de enviar; esto solo protege de un importe vacío.
    if (amount === null || amount <= 0) return;
    onSave(
      {
        ...form,
        amount,
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
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("expenses.newExpense", language)}
              </h2>
              <p className="break-words text-sm text-[var(--app-text-muted)]">
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
          {notice ? <CaptureNotice reason={notice} language={language} /> : null}
          {review?.missingFields.includes("amount") || toReview ? (
            <p className="app-section-card p-3 text-xs text-[var(--app-text-muted)]">
              {[
                review?.missingFields.includes("amount")
                  ? t("expenses.captureMissingAmount", language)
                  : null,
                toReview || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <ExpenseForm
            form={form}
            amountText={amountText}
            language={language}
            categories={categories}
            onCreateCategory={onCreateCategory}
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
                >
                  {t("common.pending", language)}
                </Button>
                <Button
                  type="button"
                  onClick={() => setInitialStatus("paid")}
                  variant={initialStatus === "paid" ? "primary" : "secondary"}
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
