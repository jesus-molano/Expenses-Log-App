"use client";

import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  CategoryPicker,
  ExpenseField,
  ExpenseSchedulePicker,
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

      <ExpenseField
        label={t("expenses.description", language)}
        optional
        language={language}
      >
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

      <ExpenseSchedulePicker
        value={form}
        language={language}
        onChange={onFormChange}
      />
    </div>
  );
}

