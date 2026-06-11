"use client";

import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  CategoryPicker,
  DayOfMonthPicker,
  ExpenseField,
  RecurrencePicker,
  TagPicker,
} from "./ExpenseFormControls";

type ExpenseFormProps = {
  form: DraftExpense;
  amountText: string;
  language: AppLanguage;
  onFormChange: (form: DraftExpense) => void;
  onAmountTextChange: (value: string) => void;
};

export function ExpenseForm({
  form,
  amountText,
  language,
  onFormChange,
  onAmountTextChange,
}: ExpenseFormProps) {
  return (
    <div className="grid gap-4">
      <ExpenseField label={t("expenses.name", language)}>
        <input
          value={form.name}
          onChange={(event) => onFormChange({ ...form, name: event.target.value })}
          required
          className="input-control"
          placeholder={t("expenses.namePlaceholder", language)}
        />
      </ExpenseField>

      <ExpenseField label={t("expenses.description", language)}>
        <textarea
          value={form.description}
          onChange={(event) =>
            onFormChange({ ...form, description: event.target.value })
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
          onChange={(event) => onAmountTextChange(event.target.value)}
          required
          className="input-control"
          placeholder={t("expenses.amountPlaceholder", language)}
        />
      </ExpenseField>

      <CategoryPicker
        value={form.categoryName}
        language={language}
        onChange={(categoryName) => onFormChange({ ...form, categoryName })}
      />

      <DayOfMonthPicker
        value={form.dueDay}
        language={language}
        onChange={(dueDay) => onFormChange({ ...form, dueDay })}
      />

      <ExpenseField label={t("expenses.endDate", language)}>
        <input
          type="date"
          value={form.endDate ?? ""}
          onChange={(event) =>
            onFormChange({
              ...form,
              endDate: event.target.value || undefined,
            })
          }
          className="input-control"
          aria-label={t("expenses.endDate", language)}
        />
        <span className="text-xs font-medium text-[var(--app-text-subtle)]">
          {t("expenses.endDateHelp", language)}
        </span>
      </ExpenseField>

      <RecurrencePicker
        value={form.recurrence}
        language={language}
        onChange={(recurrence) => onFormChange({ ...form, recurrence })}
      />

      <TagPicker
        value={form.tags}
        language={language}
        onChange={(tags) => onFormChange({ ...form, tags })}
      />
    </div>
  );
}

