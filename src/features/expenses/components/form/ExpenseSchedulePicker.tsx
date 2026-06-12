import { CalendarDays, CalendarX2, Repeat2 } from "lucide-react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Surface } from "@/components/ui/Surface";
import type {
  AppLanguage,
  DraftExpense,
  RecurrenceFrequency,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  CUSTOM_UNITS,
  RECURRENCE_OPTIONS,
} from "../../lib/expense-form-options";
import {
  updateDraftCustomInterval,
  updateDraftCustomUnit,
  updateDraftEndDate,
  updateDraftRecurrence,
  updateDraftStartDate,
} from "../../lib/expense-schedule";
import { ExpenseField } from "./ExpenseField";

type ExpenseSchedulePickerProps = {
  value: DraftExpense;
  onChange: (value: DraftExpense) => void;
  language?: AppLanguage;
};

export function ExpenseSchedulePicker({
  value,
  onChange,
  language = "es",
}: ExpenseSchedulePickerProps) {
  const isRecurring = value.recurrence.frequency !== "once";

  function changeFrequency(frequency: RecurrenceFrequency) {
    onChange(updateDraftRecurrence(value, frequency));
  }

  return (
    <Surface as="section" variant="section" padding="sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
        <CalendarDays size={17} className="text-[var(--app-accent)]" />
        {t("expenses.schedule", language)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ExpenseField label={t("expenses.startDate", language)}>
          <DatePickerField
            value={value.startDate ?? ""}
            onChange={(startDate) =>
              onChange(
                updateDraftStartDate(value, startDate),
              )
            }
            label={t("expenses.startDate", language)}
            language={language}
          />
        </ExpenseField>

        {isRecurring ? (
          <ExpenseField
            label={t("expenses.endDate", language)}
            optional
            language={language}
          >
            <DatePickerField
              min={value.startDate}
              value={value.endDate ?? ""}
              onChange={(endDate) =>
                onChange(updateDraftEndDate(value, endDate))
              }
              label={t("expenses.endDate", language)}
              language={language}
              allowClear
            />
          </ExpenseField>
        ) : (
          <div className="grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
            <span>{t("expenses.endDate", language)}</span>
            <div className="app-control flex h-12 items-center gap-2 px-3 text-sm font-semibold text-[var(--app-text-subtle)]">
              <CalendarX2 size={17} />
              {t("expenses.notApplicable", language)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
          <Repeat2 size={17} className="text-[var(--app-accent-2)]" />
          {t("expenses.recurrence", language)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {RECURRENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => changeFrequency(option.value)}
              aria-pressed={value.recurrence.frequency === option.value}
              className="app-control min-h-11 rounded-[var(--app-radius-md)] px-2 text-sm font-semibold"
              data-selected={
                value.recurrence.frequency === option.value ? "true" : "false"
              }
            >
              {t(`expenses.${option.labelKey}`, language)}
            </button>
          ))}
        </div>
      </div>

      {value.recurrence.frequency === "custom" ? (
        <div className="mt-3 grid gap-2">
          <ExpenseField label={t("expenses.recurrenceInterval", language)}>
            <input
              inputMode="numeric"
              value={value.recurrence.interval ?? 1}
              onChange={(event) =>
                onChange(
                  updateDraftCustomInterval(
                    value,
                    Math.max(Number(event.target.value) || 1, 1),
                  ),
                )
              }
              className="input-control"
              aria-label={t("expenses.recurrenceInterval", language)}
            />
          </ExpenseField>

          <div className="grid content-end grid-cols-2 gap-2 sm:grid-cols-4">
            {CUSTOM_UNITS.map((unit) => (
              <button
                key={unit.value}
                type="button"
                onClick={() => onChange(updateDraftCustomUnit(value, unit.value))}
                aria-pressed={(value.recurrence.unit ?? "month") === unit.value}
                className="app-control h-12 rounded-[var(--app-radius-md)] text-sm font-semibold"
                data-selected={
                  (value.recurrence.unit ?? "month") === unit.value
                    ? "true"
                    : "false"
                }
              >
                {t(`expenses.${unit.labelKey}`, language)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Surface>
  );
}
