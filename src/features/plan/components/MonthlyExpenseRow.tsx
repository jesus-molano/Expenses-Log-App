"use client";

import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
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
  const editor = useMonthlyExpenseRowEditor({
    occurrence,
    categories,
    language,
    onUpdate,
  });

  if (editor.editing) {
    return (
      <div className="app-list-item grid min-w-0 gap-2 p-3">
        <input
          value={editor.name}
          onChange={(event) => editor.setName(event.target.value)}
          className="input-control h-11"
        />
        <div className="grid gap-2 sm:grid-cols-2">
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => {
              const selected = editor.categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => editor.setCategoryId(category.id)}
                  aria-pressed={selected}
                  className="app-control min-h-10 rounded-[var(--app-radius-md)] px-2 text-sm font-semibold"
                  data-selected={selected ? "true" : "false"}
                >
                  <span className="line-clamp-1">
                    {categoryLabel(category.name, language)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["due", "paid"] as const).map((status) => {
            const selected = editor.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => editor.setStatus(status)}
                aria-pressed={selected}
                className="app-control h-10 rounded-[var(--app-radius-md)] text-sm font-semibold"
                data-selected={selected ? "true" : "false"}
              >
                {status === "paid"
                  ? t("common.paid", language)
                  : t("common.pending", language)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={editor.save}
            variant="primary"
            size="sm"
            leadingIcon={<Check size={16} />}
          >
            {t("expenses.saveChanges", language)}
          </Button>
          <Button
            type="button"
            onClick={editor.closeEditor}
            variant="secondary"
            size="sm"
          >
            {t("expenses.close", language)}
          </Button>
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
    <div className="app-list-item grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-3 py-2">
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
