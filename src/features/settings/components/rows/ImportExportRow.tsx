import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";

export function ImportExportRow({
  settings,
}: {
  settings: SettingsController;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="secondary"
        onClick={settings.exportData}
        className="px-3"
        leadingIcon={<Download size={17} />}
      >
        {t("settings.export")}
      </Button>
      <label className="app-button app-button-secondary cursor-pointer px-3">
        <Upload size={17} />
        {t("settings.import")}
        <input
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={(event) => void settings.importData(event.target.files?.[0])}
        />
      </label>
    </div>
  );
}
