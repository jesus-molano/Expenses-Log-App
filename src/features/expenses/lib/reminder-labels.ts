import type {
  AppLanguage,
  ExpenseReminderSettings,
  ReminderPreferences,
} from "@/domain/types";
import { t } from "@/shared/i18n";

// "1 día", "14 días".
export function formatLeadDays(days: number, language: AppLanguage) {
  return days === 1
    ? t("reminders.leadOneDay", language)
    : t("reminders.leadDays", language).replace("{days}", String(days));
}

// "08:00": la hora de los avisos siempre en punto y en 24 h.
export function formatReminderHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Aviso que confirma el cambio de la campana de una fila.
export function bellToggleMessage({
  name,
  reminder,
  pushActive,
  language,
}: {
  name: string;
  reminder: ExpenseReminderSettings;
  pushActive: boolean;
  language: AppLanguage;
}) {
  if (!reminder.enabled) {
    return t("reminders.bellDisabled", language).replace("{name}", name);
  }
  const enabled = t("reminders.bellEnabled", language)
    .replace("{name}", name)
    .replace("{lead}", formatLeadDays(reminder.daysBeforeCharge, language));
  return pushActive ? enabled : `${enabled} ${t("reminders.bellPushHint", language)}`;
}

// Resumen de la fila "Recordatorios" de Ajustes.
export function reminderPreferencesSummary(
  preferences: ReminderPreferences,
  language: AppLanguage,
) {
  const hour = formatReminderHour(preferences.pushHour);
  return preferences.defaultEnabled
    ? t("reminders.rowSummaryAll", language)
        .replace("{lead}", formatLeadDays(preferences.defaultDaysBefore, language))
        .replace("{hour}", hour)
    : t("reminders.rowSummaryOwn", language).replace("{hour}", hour);
}
