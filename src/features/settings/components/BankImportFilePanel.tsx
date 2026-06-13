"use client";

import { Upload } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type BankImportFilePanelProps = {
  isReading: boolean;
  message: string;
  language: AppLanguage;
  onFile: (file: File) => void;
};

export function BankImportFilePanel({
  isReading,
  message,
  language,
  onFile,
}: BankImportFilePanelProps) {
  return (
    <section className="app-import-file-row mt-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[var(--app-text)]">
            {t("settings.bankImportFileTitle", language)}
          </p>
          <p className="mt-1 text-xs font-medium leading-snug text-[var(--app-text-muted)]">
            {message || t("settings.bankImportFileHelp", language)}
          </p>
        </div>

        <label className="app-button app-button-sm app-import-upload-button cursor-pointer">
          <Upload size={17} />
          {isReading
            ? t("common.loading", language)
            : t("settings.bankImportUpload", language)}
          <input
            type="file"
            className="sr-only"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={isReading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}
