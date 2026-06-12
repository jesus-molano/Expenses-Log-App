import type { AppTheme } from "@/domain/types";

export const DEFAULT_THEME: AppTheme = "dark";

export function setThemeDom(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function persistThemePreference(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.cookie = `expense-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function applyAppTheme(theme: AppTheme) {
  setThemeDom(theme);
  persistThemePreference(theme);
}

export function readThemeCookie(): AppTheme | null {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("expense-theme="))
    ?.split("=")[1];

  return isAppTheme(value) ? value : null;
}

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    value === "dark" ||
    value === "rose-pine" ||
    value === "catppuccin" ||
    value === "light"
  );
}
