import {
  DEFAULT_REMINDER_PREFERENCES,
  resolveReminderPreferences,
  sanitizeReminderPreferences,
} from "@/domain/reminder-schedule";
import type {
  AppLanguage,
  AppTheme,
  ExpenseStore,
  ReminderPreferences,
} from "@/domain/types";
import { DEFAULT_THEME } from "@/shared/theme";

export function updateThemeInStore(
  store: ExpenseStore,
  theme: AppTheme,
): ExpenseStore {
  return {
    ...store,
    preferences: {
      ...store.preferences,
      theme,
      language: store.preferences?.language ?? "es",
    },
  };
}

export function updateLanguageInStore(
  store: ExpenseStore,
  language: AppLanguage,
): ExpenseStore {
  return {
    ...store,
    preferences: {
      ...store.preferences,
      theme: store.preferences?.theme ?? DEFAULT_THEME,
      language,
    },
  };
}

export type ReminderPreferencesInput = Partial<Omit<ReminderPreferences, "updatedAt">>;

// Cambia los ajustes de avisos partiendo de los vigentes (o de los valores por
// defecto) y les pone hora para que el merge entre dispositivos los respete.
export function updateReminderPreferencesInStore(
  store: ExpenseStore,
  changes: ReminderPreferencesInput,
  now: Date = new Date(),
): ExpenseStore {
  return {
    ...store,
    preferences: {
      ...store.preferences,
      theme: store.preferences?.theme ?? DEFAULT_THEME,
      language: store.preferences?.language ?? "es",
      // Pasa por la misma validación que al cargar: una hora o una zona
      // horaria imposibles vuelven a su valor por defecto.
      reminders:
        sanitizeReminderPreferences({
          ...resolveReminderPreferences(store),
          ...changes,
          updatedAt: now.toISOString(),
        }) ?? DEFAULT_REMINDER_PREFERENCES,
    },
  };
}
