"use client";

import { useEffect } from "react";
import { loadExpenseStore } from "@/lib/local-store";
import { DEFAULT_LANGUAGE, readLanguageCookie } from "@/lib/i18n";
import { DEFAULT_THEME, readThemeCookie, setThemeDom } from "@/lib/theme";

export function ThemeApplier() {
  useEffect(() => {
    const applyTheme = () => {
      const theme =
        readThemeCookie() ??
        loadExpenseStore().preferences?.theme ??
        DEFAULT_THEME;
      const language =
        readLanguageCookie() ??
        loadExpenseStore().preferences?.language ??
        DEFAULT_LANGUAGE;
      setThemeDom(theme);
      document.documentElement.lang = language;
    };

    applyTheme();
    window.addEventListener("storage", applyTheme);
    window.addEventListener("expense-store-updated", applyTheme);

    return () => {
      window.removeEventListener("storage", applyTheme);
      window.removeEventListener("expense-store-updated", applyTheme);
    };
  }, []);

  return null;
}
