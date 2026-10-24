import type { CategoryInput } from "@/domain/categories";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseCategory,
  ReminderPreferences,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { isValidPositiveMoneyInput } from "@/shared/money";
import {
  CategoryPicker,
  ExpenseField,
  ExpenseSchedulePicker,
} from "./ExpenseFormControls";
import { ExpenseDetailsFields } from "./form/ExpenseDetailsFields";
import { ReminderControls } from "./form/ReminderControls";

type ExpenseFormProps = {
  form: DraftExpense;
  amountText: string;
  language: AppLanguage;
  // Aviso por defecto de Ajustes, para mostrar el de un gasto sin ajuste propio.
  reminderPreferences?: ReminderPreferences;
  // Categorías guardadas (propias y colores) y alta de una nueva.
  categories?: ExpenseCategory[];
  onCreateCategory?: (input: CategoryInput) => string | null;
  onFormChange: (form: DraftExpense) => void;
  onAmountTextChange: (value: string) => void;
};

export function ExpenseForm({
  form,
  amountText,
  language,
  reminderPreferences = DEFAULT_REMINDER_PREFERENCES,
  categories,
  onCreateCategory,
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
          ref={(input) =>
            input?.setCustomValidity(
              isValidPositiveMoneyInput(amountText)
                ? ""
                : t("expenses.amountInvalid", language),
            )
          }
          aria-invalid={!isValidPositiveMoneyInput(amountText) || undefined}
          required
          className="input-control"
          placeholder={t("expenses.amountPlaceholder", language)}
        />
      </ExpenseField>

      <CategoryPicker
        value={form.categoryName}
        language={language}
        categories={categories}
        onCreateCategory={onCreateCategory}
        onChange={(categoryName) => onFormChange({ ...form, categoryName })}
      />

      <ExpenseSchedulePicker
        value={form}
        language={language}
        onChange={onFormChange}
      />

      <ReminderControls
        value={form}
        preferences={reminderPreferences}
        language={language}
        onChange={onFormChange}
      />

      <ExpenseDetailsFields value={form} language={language} onChange={onFormChange} />
    </div>
  );
}
