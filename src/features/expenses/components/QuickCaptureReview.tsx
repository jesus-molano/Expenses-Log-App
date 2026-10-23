"use client";

import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import { foldText, type CapturedDraft } from "@/domain/expense-capture";
import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import { inferredFieldsLabel } from "../lib/capture-labels";
import { localizedRecurrenceLabel } from "../lib/recurrence-label";

type QuickCaptureReviewProps = {
  items: CapturedDraft[];
  existingNames: string[];
  language: AppLanguage;
  onEdit: (index: number) => void;
  onSave: (drafts: DraftExpense[]) => void;
  onClose: () => void;
};

// Varios gastos de una misma captura: se revisan juntos y se guardan de una
// vez. Uno sin importe no se puede marcar hasta editarlo.
export function QuickCaptureReview({
  items,
  existingNames,
  language,
  onEdit,
  onSave,
  onClose,
}: QuickCaptureReviewProps) {
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set());
  const existing = new Set(existingNames.map(foldText));
  const selectable = (item: CapturedDraft) => item.draft.amount > 0;
  const selected = items.filter(
    (item, index) => selectable(item) && !excluded.has(index),
  );

  function toggle(index: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

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

        <ul className="grid gap-2 px-5">
          {items.map((item, index) => {
            const { draft } = item;
            const canSelect = selectable(item);
            const checkboxId = `capture-item-${index}`;
            const toReview = inferredFieldsLabel(item.inferredFields, language);
            return (
              <li key={`${draft.name}-${index}`} className="app-section-card grid gap-2 p-3">
                <div className="flex items-start gap-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-[var(--app-accent)]"
                    checked={canSelect && !excluded.has(index)}
                    disabled={!canSelect}
                    onChange={() => toggle(index)}
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
                        draft.categoryName,
                      ].join(" · ")}
                    </span>
                  </label>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(index)}
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

        <div className="grid gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={selected.length === 0}
            onClick={() => onSave(selected.map((item) => item.draft))}
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
