import type { AppTheme } from "@/domain/types";

export const APP_THEMES = [
  "atlas",
  "obsidian-amber",
  "vice-afterglow",
  "catppuccin",
  "rose-pine",
  "nord",
  "dracula",
  "tokyo-night",
] as const satisfies readonly AppTheme[];

export const DEFAULT_THEME: AppTheme = "vice-afterglow";

export function normalizeAppTheme(value: unknown): AppTheme {
  if (value === "dark" || value === "light") return DEFAULT_THEME;
  return isAppTheme(value) ? value : DEFAULT_THEME;
}

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

  if (value === "dark" || value === "light") return DEFAULT_THEME;
  return isAppTheme(value) ? value : null;
}

export function isAppTheme(value: unknown): value is AppTheme {
  return APP_THEMES.some((theme) => theme === value);
}
