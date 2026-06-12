"use client";

import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Check, Pencil, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { IconButton } from "@/components/ui/IconButton";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { formatCurrency } from "@/domain/calendar";
import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { categoryIconMap } from "@/features/expenses/lib/expense-form-options";
import {
  useMonthlyExpenseRowEditor,
  type MonthlyExpenseUpdateInput,
} from "@/features/plan/hooks/use-monthly-expense-row-editor";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";

export function MonthlyExpenseRow({
  occurrence,
  categories,
  language,
  today,
  skipLabel,
  onSkip,
  onUpdate,
}: {
  occurrence: ExpenseOccurrence;
  categories: ExpenseCategory[];
  language: AppLanguage;
  today: string;
  skipLabel: string;
  onSkip: () => void;
  onUpdate: (input: MonthlyExpenseUpdateInput) => void;
}) {
  const locale = language === "en" ? enUS : es;
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const editor = useMonthlyExpenseRowEditor({
    occurrence,
    categories,
    language,
    onUpdate,
  });
  const categoryOptions = PRESET_EXPENSE_CATEGORIES.map((category) => {
    const Icon = categoryIconMap[category.icon] ?? WalletCards;

    return {
      value: category.name,
      label: categoryLabel(category.name, language),
      leading: (
        <span
          className="app-monthly-category-menu-icon"
          data-tone={category.tone}
        >
          <Icon size={14} />
        </span>
      ),
    };
  });

  if (editor.editing) {
    return (
      <div
        className="app-list-item app-monthly-table-row app-monthly-table-row-editing grid min-w-0 gap-2 p-3"
        data-editing="true"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <input
            value={editor.name}
            onChange={(event) => editor.setName(event.target.value)}
            className="input-control h-11 min-w-0"
          />
          <IconButton
            type="button"
            onClick={editor.save}
            aria-label={t("expenses.saveChanges", language)}
            size="sm"
            className="bg-[var(--app-accent)] text-[var(--app-accent-contrast)]"
          >
            <Check size={15} />
          </IconButton>
          <IconButton
            type="button"
            onClick={editor.closeEditor}
            aria-label={t("expenses.close", language)}
            size="sm"
          >
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
          <input
            value={editor.amount}
            inputMode="decimal"
            onChange={(event) => editor.setAmount(event.target.value)}
            className="input-control h-11 min-w-0"
          />
          <DatePickerField
            value={editor.dueDate}
            onChange={(value) => editor.setDueDate(value ?? editor.dueDate)}
            label={t("expenses.chargeDate", language)}
            language={language}
            className="h-11 min-w-0"
          />
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold text-[var(--app-text-muted)]">
            {t("expenses.category", language)}
          </p>
          <SelectMenu
            open={categoryMenuOpen}
            onOpenChange={setCategoryMenuOpen}
            value={editor.categoryName}
            options={categoryOptions}
            onChange={editor.setCategoryName}
            align="left"
          />
        </div>
        <div className="app-monthly-status-toggle" role="group">
          {(["due", "paid"] as const).map((status) => {
            const selected = editor.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => editor.setStatus(status)}
                aria-pressed={selected}
                className="app-monthly-status-option h-9 text-sm font-semibold"
                data-status={status}
                data-selected={selected ? "true" : "false"}
              >
                {status === "paid"
                  ? t("common.paid", language)
                  : t("common.pending", language)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isPaid = occurrence.status === "paid";
  const isOverdue = occurrence.status !== "paid" && occurrence.dueDate < today;
  const status = isPaid
    ? t("common.paid", language)
    : isOverdue
      ? t("expenses.overdue", language)
      : t("common.pending", language);

  return (
    <div className="app-list-item app-monthly-table-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-3 py-2">
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            isPaid
              ? "text-[var(--app-text-subtle)] line-through"
              : "text-[var(--app-text)]"
          }`}
        >
          {occurrence.template.name}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-[var(--app-text-muted)]">
          {format(new Date(`${occurrence.dueDate}T00:00:00`), "d MMM", {
            locale,
          })}{" "}
          - {categoryLabel(editor.categoryName, language)} - {status}
        </p>
      </div>
      <p
        className={`text-sm font-semibold ${
          isPaid
            ? "text-[var(--app-text-subtle)] line-through"
            : "text-[var(--app-text)]"
        }`}
      >
        {formatCurrency(occurrence.template.amount)}
      </p>
      <IconButton
        type="button"
        onClick={editor.openEditor}
        aria-label={t("common.edit", language)}
        size="sm"
      >
        <Pencil size={14} />
      </IconButton>
      <IconButton
        type="button"
        onClick={onSkip}
        aria-label={skipLabel}
        title={skipLabel}
        variant="danger"
        size="sm"
      >
        <X size={15} />
      </IconButton>
    </div>
  );
}
