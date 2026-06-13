import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function ImportExportRow({
  settings,
}: {
  settings: SettingsController;
}) {
  const from = settings.backHref === "/money" ? "money" : "expenses";

  return (
    <SettingRow
      icon={<FileSpreadsheet size={18} />}
      title={t("settings.bankImport", settings.currentLanguage)}
      description={t("settings.bankImportHelp", settings.currentLanguage)}
      action={
        <Link
          href={`/settings/import?from=${from}`}
          className="app-button app-button-secondary app-button-sm"
        >
          <Upload size={15} />
          {t("settings.bankImportUpload", settings.currentLanguage)}
        </Link>
      }
    />
  );
}
