"use client";

import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { firstChargeAlreadyPassed } from "@/domain/recurrence";
import { foldText } from "@/domain/text";
import type { AppLanguage, CreateExpenseOptions } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import type { ReviewItem } from "../hooks/use-expense-capture-flow";
import { inferredFieldsLabel, type CaptureReason } from "../lib/capture-labels";
import { localizedRecurrenceLabel } from "../lib/recurrence-label";
import { CaptureNotice } from "./CaptureNotice";

type InitialStatus = NonNullable<CreateExpenseOptions["initialStatus"]>;

type QuickCaptureReviewProps = {
  items: ReviewItem[];
  excludedIds: Set<string>;
  initialStatus: InitialStatus;
  notice: CaptureReason | null;
  existingNames: string[];
  language: AppLanguage;
  onToggle: (id: string) => void;
  onInitialStatusChange: (status: InitialStatus) => void;
  onEdit: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

// Varios gastos de una misma captura: se revisan juntos y se guardan de una
// vez. Uno sin importe no se puede marcar hasta editarlo.
export function QuickCaptureReview({
  items,
  excludedIds,
  initialStatus,
  notice,
  existingNames,
  language,
  onToggle,
  onInitialStatusChange,
  onEdit,
  onSave,
  onClose,
}: QuickCaptureReviewProps) {
  const existing = new Set(existingNames.map(foldText));
  const selectable = (item: ReviewItem) => item.draft.amount > 0;
  const selected = items.filter((item) => selectable(item) && !excludedIds.has(item.id));
  // Como en el formulario de uno: si alguno ya se cobró este mes, se pregunta.
  const today = toDateOnly(new Date());
  const asksPaid = selected.some((item) => firstChargeAlreadyPassed(item.draft, today));

  return (
    <Sheet ariaLabel={t("expenses.captureReviewTitle", language)} onBackdropClick={onClose}>
      <section>
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("expenses.captureReviewTitle", language)}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("expenses.captureReviewSubtitle", language)}
              </p>
            </div>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label={t("expenses.close", language)}
              className="shrink-0"
            >
              <X size={18} />
            </IconButton>
          </header>
        </div>

        {notice ? (
          <div className="px-5 pb-2">
            <CaptureNotice reason={notice} language={language} />
          </div>
        ) : null}

        <ul className="grid gap-2 px-5">
          {items.map((item) => {
            const { draft } = item;
            const canSelect = selectable(item);
            const checkboxId = `capture-item-${item.id}`;
            const toReview = inferredFieldsLabel(item.inferredFields, language);
            return (
              <li key={item.id} className="app-section-card grid gap-2 p-3">
                <div className="flex items-start gap-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-[var(--app-accent)]"
                    checked={canSelect && !excludedIds.has(item.id)}
                    disabled={!canSelect}
                    onChange={() => onToggle(item.id)}
                    aria-label={t("expenses.captureInclude", language).replace("{name}", draft.name)}
                  />
                  <label htmlFor={checkboxId} className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--app-text)]">
                        {draft.name}
                      </span>
                      <span className="app-money shrink-0 text-sm font-semibold text-[var(--app-text)]">
                        {canSelect ? formatCurrency(draft.amount) : "—"}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--app-text-muted)]">
                      {[
                        localizedRecurrenceLabel(draft.recurrence, language),
                        t("expenses.captureDay", language).replace("{day}", String(draft.dueDay)),
                        categoryLabel(draft.categoryName, language),
                      ].join(" · ")}
                    </span>
                  </label>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(item.id)}
                    aria-label={`${t("expenses.captureEdit", language)}: ${draft.name}`}
                  >
                    <Pencil size={15} />
                  </IconButton>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-8 text-xs">
                  {!canSelect ? (
                    <span className="app-chip app-chip-orange px-2 py-0.5 font-medium">
                      {t("expenses.captureMissingAmount", language)}
                    </span>
                  ) : null}
                  {existing.has(foldText(draft.name)) ? (
                    <span className="app-chip px-2 py-0.5 font-medium">
                      {t("expenses.captureAlreadyExists", language)}
                    </span>
                  ) : null}
                  {toReview ? (
                    <span className="text-[var(--app-text-muted)]">{toReview}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {asksPaid ? (
          <div className="px-5 pt-4">
            <div className="app-section-card border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] p-3">
              <p className="text-sm font-semibold text-[var(--app-warning)]">
                {t("expenses.captureReviewPastTitle", language)}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                {t("expenses.captureReviewPastBody", language)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => onInitialStatusChange("due")}
                  variant={initialStatus === "due" ? "primary" : "secondary"}
                  size="sm"
                  className="h-10"
                  aria-pressed={initialStatus === "due"}
                >
                  {t("common.pending", language)}
                </Button>
                <Button
                  type="button"
                  onClick={() => onInitialStatusChange("paid")}
                  variant={initialStatus === "paid" ? "primary" : "secondary"}
                  size="sm"
                  className="h-10"
                  aria-pressed={initialStatus === "paid"}
                >
                  {t("common.paid", language)}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={selected.length === 0}
            onClick={onSave}
          >
            {t("expenses.captureSaveMany", language).replace("{count}", String(selected.length))}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("expenses.captureCancel", language)}
          </Button>
        </div>
      </section>
    </Sheet>
  );
}
