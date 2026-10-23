"use client";

import { useRef } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BackupFormat } from "@/data/persistence/backup-file";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { SettingRow } from "../SettingRow";

export function ExportRow({
  language,
  onExport,
}: {
  language: AppLanguage;
  onExport: (format: BackupFormat) => void;
}) {
  return (
    <SettingRow
      icon={<Download size={18} />}
      title={t("backup.exportTitle", language)}
      description={t("backup.exportHelp", language)}
      wrapDescription
      action={
        <span className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport("json")}
            aria-label={t("backup.exportJsonLabel", language)}
          >
            {t("backup.exportJson", language)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport("csv")}
            aria-label={t("backup.exportCsvLabel", language)}
          >
            {t("backup.exportCsv", language)}
          </Button>
        </span>
      }
    />
  );
}

export function ImportRow({
  language,
  reading,
  onFile,
}: {
  language: AppLanguage;
  reading: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <SettingRow
      icon={<FileUp size={18} />}
      title={t("backup.importTitle", language)}
      description={t("backup.importHelp", language)}
      wrapDescription
      action={
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            aria-label={t("backup.importFileLabel", language)}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Vaciar el campo deja volver a elegir el mismo archivo.
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
          >
            {reading ? t("backup.importReading", language) : t("backup.importAction", language)}
          </Button>
        </>
      }
    />
  );
}
