import type { AppLanguage, AppTheme } from "@/domain/types";

export const SETTINGS_THEMES: Array<{
  id: AppTheme;
  label: string;
  swatches: [string, string, string];
}> = [
  { id: "atlas", label: "Atlas", swatches: ["#14171c", "#ff5b4d", "#83a7c4"] },
  { id: "obsidian-amber", label: "Obsidian Amber", swatches: ["#0a0907", "#ffc857", "#ff9f1c"] },
  { id: "vice-afterglow", label: "Vice Afterglow", swatches: ["#0c0d1b", "#f77e9c", "#9b89f5"] },
  { id: "catppuccin", label: "Catppuccin Mocha", swatches: ["#1e1e2e", "#cba6f7", "#fab387"] },
  { id: "rose-pine", label: "Rosé Pine Moon", swatches: ["#191724", "#c4a7e7", "#9ccfd8"] },
  { id: "nord", label: "Nord Night", swatches: ["#2e3440", "#8fbcbb", "#88c0d0"] },
  { id: "dracula", label: "Dracula Violet", swatches: ["#282a36", "#bd93f9", "#ff79c6"] },
  { id: "tokyo-night", label: "Tokyo Night City", swatches: ["#1a1b26", "#7aa2f7", "#bb9af7"] },
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
