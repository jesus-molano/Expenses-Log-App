import { BellRing } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
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

      <ReminderControls
        value={form}
        language={language}
        onChange={onFormChange}
      />
    </div>
  );
}

function ReminderControls({
  value,
  language,
  onChange,
}: {
  value: DraftExpense;
  language: AppLanguage;
  onChange: (form: DraftExpense) => void;
}) {
  const reminder = value.reminder ?? { enabled: false, daysBeforeCharge: 3 };

  function setEnabled(enabled: boolean) {
    onChange({
      ...value,
      reminder: {
        enabled,
        daysBeforeCharge: reminder.daysBeforeCharge,
      },
    });
  }

  function setDaysBeforeCharge(daysBeforeCharge: number) {
    onChange({
      ...value,
      reminder: {
        enabled: true,
        daysBeforeCharge,
      },
    });
  }

  return (
    <Surface as="section" variant="section" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
            <BellRing size={17} className="text-[var(--app-warning)]" />
            {t("expenses.lastChanceReminder", language)}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
            {t("expenses.lastChanceReminderHelp", language)}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reminder.enabled}
          onClick={() => setEnabled(!reminder.enabled)}
          className="app-switch"
          data-state={reminder.enabled ? "on" : "off"}
        >
          <span className="sr-only">
            {t("expenses.lastChanceReminder", language)}
          </span>
        </button>
      </div>

      {reminder.enabled ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={reminder.daysBeforeCharge === day}
              onClick={() => setDaysBeforeCharge(day)}
              className="app-control h-11 rounded-[var(--app-radius-md)] text-sm font-semibold"
              data-selected={
                reminder.daysBeforeCharge === day ? "true" : "false"
              }
            >
              {day}d
            </button>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}
