import type { ExpenseStore } from "@/domain/types";
import { readLanguageCookie } from "@/shared/i18n";
import { readThemeCookie } from "@/shared/theme";

export function applyRuntimePreferences(store: ExpenseStore): ExpenseStore {
  const theme = readThemeCookie();
  const language = readLanguageCookie();

  if (!theme && !language) return store;

  return {
    ...store,
    preferences: {
      ...store.preferences,
      theme: theme ?? store.preferences?.theme ?? "dark",
      language: language ?? store.preferences?.language ?? "es",
    },
  };
}
