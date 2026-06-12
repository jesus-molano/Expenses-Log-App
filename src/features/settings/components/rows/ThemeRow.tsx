import { Palette } from "lucide-react";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { t } from "@/shared/i18n";
import {
  SETTINGS_THEMES,
  ThemeSwatches,
} from "../../lib/settings-options";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function ThemeRow({ settings }: { settings: SettingsController }) {
  return (
    <SettingRow
      icon={<Palette size={18} />}
      title={t("settings.theme")}
      description={settings.selectedTheme.label}
      action={
        <SelectMenu
          open={settings.themeOpen}
          onOpenChange={settings.setThemeOpen}
          value={settings.currentTheme}
          onChange={(value) => settings.updateTheme(value)}
          options={SETTINGS_THEMES.map((theme) => ({
            value: theme.id,
            label: theme.label,
            leading: <ThemeSwatches swatches={theme.swatches} />,
          }))}
        />
      }
    />
  );
}
