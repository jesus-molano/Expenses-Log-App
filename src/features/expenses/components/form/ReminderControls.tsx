import { useId } from "react";
import { BellRing } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
import { Switch } from "@/components/ui/Switch";
import {
  leadDayOptions,
  resolveTemplateReminder,
} from "@/domain/reminder-schedule";
import type {
  AppLanguage,
  DraftExpense,
  ReminderPreferences,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatLeadDays } from "../../lib/reminder-labels";

type ReminderControlsProps = {
  value: DraftExpense;
  preferences: ReminderPreferences;
  language: AppLanguage;
  onChange: (form: DraftExpense) => void;
};

// Aviso del gasto: sigue el de Ajustes hasta que se toca, y entonces queda
// como ajuste propio. Trimestrales y anuales ofrecen hasta 30 días.
export function ReminderControls({
  value,
  preferences,
  language,
  onChange,
}: ReminderControlsProps) {
  const titleId = useId();
  const reminder = resolveTemplateReminder(value, preferences);
  const options = leadDayOptions(value.recurrence);

  function setEnabled(enabled: boolean) {
    onChange({
      ...value,
      reminder: { enabled, daysBeforeCharge: reminder.daysBeforeCharge },
    });
  }

  function setDaysBeforeCharge(daysBeforeCharge: number) {
    onChange({ ...value, reminder: { enabled: true, daysBeforeCharge } });
  }

  return (
    <Surface as="section" variant="section" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            id={titleId}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]"
          >
            <BellRing size={17} className="text-[var(--app-warning)]" />
            {t("expenses.lastChanceReminder", language)}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
            {t("expenses.lastChanceReminderHelp", language)}
          </p>
        </div>
        <Switch
          checked={reminder.enabled}
          onCheckedChange={setEnabled}
          aria-labelledby={titleId}
        />
      </div>

      {reminder.enabled ? (
        <div
          role="group"
          aria-label={t("reminders.formLeadLabel", language)}
          className="mt-3 grid grid-cols-5 gap-2"
        >
          {options.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={reminder.daysBeforeCharge === day}
              aria-label={formatLeadDays(day, language)}
              onClick={() => setDaysBeforeCharge(day)}
              className="app-control h-11 rounded-[var(--app-radius-md)] text-sm font-semibold"
              data-selected={reminder.daysBeforeCharge === day ? "true" : "false"}
            >
              {day}d
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2">
        {reminder.source === "default" ? (
          <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
            {reminder.enabled
              ? t("reminders.formDefaultOn", language).replace(
                  "{lead}",
                  formatLeadDays(reminder.daysBeforeCharge, language),
                )
              : t("reminders.formDefaultOff", language)}
          </p>
        ) : (
          <button
            type="button"
            className="app-button app-button-ghost app-button-sm"
            onClick={() => onChange({ ...value, reminder: undefined })}
          >
            {t("reminders.formUseDefault", language)}
          </button>
        )}
      </div>
    </Surface>
  );
}
