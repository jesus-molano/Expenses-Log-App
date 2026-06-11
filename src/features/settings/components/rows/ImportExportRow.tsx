"use client";

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
      <Button variant="secondary" onClick={settings.exportData} className="px-3">
        <Download size={17} />
        {t("settings.export")}
      </Button>
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
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
