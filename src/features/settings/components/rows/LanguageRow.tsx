import { SelectMenu } from "@/components/ui/SelectMenu";
import { t } from "@/shared/i18n";
import { SETTINGS_LANGUAGES } from "../../lib/settings-options";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function LanguageRow({ settings }: { settings: SettingsController }) {
  return (
    <SettingRow
      icon={<span className="text-sm font-bold">Aa</span>}
      title={t("common.language")}
      description={settings.languageLabel}
      action={
        <SelectMenu
          open={settings.languageOpen}
          onOpenChange={settings.setLanguageOpen}
          value={settings.currentLanguage}
          label={settings.currentLanguage.toUpperCase()}
          onChange={(value) => settings.updateLanguage(value)}
          options={SETTINGS_LANGUAGES.map((language) => ({
            value: language.id,
            label: language.label,
            detail: language.id.toUpperCase(),
          }))}
        />
      }
    />
  );
}
