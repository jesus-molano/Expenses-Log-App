import type { AppLanguage, AppTheme } from "@/domain/types";

export const SETTINGS_THEMES: Array<{
  id: AppTheme;
  label: string;
  swatches: [string, string, string];
}> = [
  { id: "dark", label: "Dark", swatches: ["#0b1220", "#3b82f6", "#06b6d4"] },
  { id: "rose-pine", label: "Rosé Pine", swatches: ["#191724", "#ebbcba", "#9ccfd8"] },
  { id: "catppuccin", label: "Catppuccin", swatches: ["#11111b", "#cba6f7", "#74c7ec"] },
  { id: "light", label: "Light", swatches: ["#f7f9fc", "#2563eb", "#0891b2"] },
];

export const SETTINGS_LANGUAGES: Array<{ id: AppLanguage; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

export function ThemeSwatches({
  swatches,
}: {
  swatches: [string, string, string];
}) {
  return (
    <span className="flex -space-x-1">
      {swatches.map((swatch) => (
        <span
          key={swatch}
          className="size-3 rounded-full border border-[var(--app-border)]"
          style={{ backgroundColor: swatch }}
        />
      ))}
    </span>
  );
}
