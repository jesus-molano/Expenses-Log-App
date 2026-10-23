"use client";

import { useState } from "react";
import { BackupFileError } from "@/data/persistence/backup-errors";
import {
  backupFileName,
  buildJsonBackup,
  MAX_BACKUP_FILE_BYTES,
  parseBackupFile,
  type BackupFormat,
  type ParsedBackup,
} from "@/data/persistence/backup-file";
import { storeToCsv } from "@/data/persistence/store-csv";
import type { AppLanguage } from "@/domain/types";
import { downloadTextFile } from "@/shared/download-file";
import { formatMessage, t } from "@/shared/i18n";
import type { ImportMode } from "@/stores/app/backup-commands";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import {
  importErrorMessage,
  previewImport,
  type ImportPreview,
} from "../lib/backup-summary";

export type PendingImport = {
  fileName: string;
  parsed: ParsedBackup;
  preview: ImportPreview;
};

const MIME_TYPES: Record<BackupFormat, string> = {
  json: "application/json",
  csv: "text/csv;charset=utf-8",
};

// Exportar a JSON o CSV e importar en dos pasos: leer el archivo y enseñar lo
// que trae y lo que quedaría con cada modo, y solo al confirmar, importarlo.
export function useDataTransfer({
  language,
  onMessage,
}: {
  language: AppLanguage;
  onMessage: (message: string) => void;
}) {
  const { store, importStore } = useExpenseStore();
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  function exportFile(format: BackupFormat) {
    try {
      const now = new Date();
      const fileName = backupFileName(format, now);
      const content =
        format === "json"
          ? buildJsonBackup(store, now)
          : storeToCsv(store, { today: now, language });
      downloadTextFile(fileName, content, MIME_TYPES[format]);
      onMessage(formatMessage("backup.exported", { file: fileName }, language));
    } catch (error) {
      console.error("Export failed", error);
      onMessage(t("backup.exportError", language));
    }
  }

  async function selectFile(file: File) {
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      onMessage(importErrorMessage("too-large", language));
      return;
    }
    setReading(true);
    try {
      const now = new Date();
      const parsed = parseBackupFile(
        { name: file.name, text: await file.text() },
        { now, current: store },
      );
      setMode("merge");
      setPending({ fileName: file.name, parsed, preview: previewImport(store, parsed, now) });
    } catch (error) {
      onMessage(
        error instanceof BackupFileError
          ? importErrorMessage(error.code, language)
          : t("backup.importErrorUnreadable", language),
      );
    } finally {
      setReading(false);
    }
  }

  async function confirmImport() {
    if (!pending || importing) return;
    setImporting(true);
    try {
      await importStore(pending.parsed.store, { mode, scope: pending.parsed.scope });
      setPending(null);
      onMessage(t("backup.imported", language));
    } catch (error) {
      console.error("Import failed", error);
      onMessage(t("backup.importFailed", language));
    } finally {
      setImporting(false);
    }
  }

  function cancelImport() {
    if (!importing) setPending(null);
  }

  return {
    pending,
    mode,
    reading,
    importing,
    setMode,
    exportFile,
    selectFile,
    confirmImport,
    cancelImport,
  };
}
