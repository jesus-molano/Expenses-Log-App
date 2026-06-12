"use client";

import { Repeat, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { t } from "@/shared/i18n";
import { RecurringOverviewCard } from "./recurring/RecurringOverviewCard";
import type { RecurringOverviewItem } from "../lib/recurring-overview";

type RecurringOverviewSheetProps = {
  open: boolean;
  items: RecurringOverviewItem[];
  categories: ExpenseCategory[];
  language: AppLanguage;
  onClose: () => void;
};

export function RecurringOverviewSheet({
  open,
  items,
  categories,
  language,
  onClose,
}: RecurringOverviewSheetProps) {
  if (!open) return null;

  return (
    <Sheet
      onBackdropClick={onClose}
      contentClassName="max-h-[88dvh] sm:max-w-lg"
    >
      <section className="grid gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_13%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--app-accent)]">
              <Repeat size={14} />
              {t("expenses.recurring", language)}
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight text-[var(--app-text)]">
              {t("expenses.activeSeries", language)}
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)]">
              {t("expenses.longCycleSeries", language)}
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

        {items.length ? (
          <div className="app-section-card px-3">
            {items.map((item) => (
              <RecurringOverviewCard
                key={item.template.id}
                item={item}
                category={categories.find(
                  (category) => category.id === item.template.categoryId,
                )}
                language={language}
              />
            ))}
          </div>
        ) : (
          <div className="app-empty-line p-5 text-sm font-medium">
            {t("expenses.noRecurringSeries", language)}
          </div>
        )}
      </section>
    </Sheet>
  );
}
