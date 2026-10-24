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

// Fondo de cada tema (`--noctalia-background` en tokens.css) para la barra del
// sistema (`theme-color`). Un test comprueba que coinciden con el CSS: el
// navegador no puede leer variables CSS en la meta.
export const THEME_COLORS: Record<AppTheme, string> = {
  atlas: "#090a0d",
  "obsidian-amber": "#070604",
  "vice-afterglow": "#070810",
  catppuccin: "#1e1e2e",
  "rose-pine": "#191724",
  nord: "#2e3440",
  dracula: "#282a36",
  "tokyo-night": "#15161e",
};

export function normalizeAppTheme(value: unknown): AppTheme {
  if (value === "dark" || value === "light") return DEFAULT_THEME;
  return isAppTheme(value) ? value : DEFAULT_THEME;
}

export function setThemeDom(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  applyThemeColor(theme);
}

// Pinta la barra de estado (Android) y la de título (escritorio) del color del
// tema. La meta la crea el layout; si faltara, se añade.
export function applyThemeColor(theme: AppTheme) {
  if (typeof document === "undefined") return;
  const color = THEME_COLORS[theme] ?? THEME_COLORS[DEFAULT_THEME];
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (!metas.length) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => {
    meta.content = color;
  });
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
