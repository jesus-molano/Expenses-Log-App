import type { AppLanguage, AppTheme, ExpenseStore } from "@/domain/types";
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
