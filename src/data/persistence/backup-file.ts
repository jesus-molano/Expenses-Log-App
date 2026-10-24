import { toDateOnly } from "@/domain/calendar";
import type { ExpenseStore } from "@/domain/types";
import { BackupFileError } from "./backup-errors";
import { csvToStore } from "./store-csv";
import { normalizeImportedExpenseStore } from "./store-normalization";

// Copia JSON: el store completo dentro de un sobre que dice qué es y cuándo
// se hizo. Al importar también se acepta el store a secas.
export const BACKUP_FILE_KIND = "expense-log-backup";
export const BACKUP_FILE_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

export type BackupFormat = "json" | "csv";

// Qué parte del store trae el archivo: el JSON lo trae entero; el CSV, solo
// los gastos, sus cobros y el histórico (sin Plan, ingresos ni preferencias).
export type BackupScope = "all" | "expenses";

export type ParsedBackup = {
  format: BackupFormat;
  scope: BackupScope;
  store: ExpenseStore;
  exportedAt?: string;
  skippedRows: number;
};

export function buildJsonBackup(store: ExpenseStore, now = new Date()): string {
  return JSON.stringify(
    {
      kind: BACKUP_FILE_KIND,
      version: BACKUP_FILE_VERSION,
      exportedAt: now.toISOString(),
      store,
    },
    null,
    2,
  );
}

export function backupFileName(format: BackupFormat, now = new Date()) {
  return `expense-log-${toDateOnly(now)}.${format}`;
}

export function parseBackupFile(
  { name, text }: { name: string; text: string },
  { now = new Date(), current }: { now?: Date; current?: ExpenseStore } = {},
): ParsedBackup {
  if (text.length > MAX_BACKUP_FILE_BYTES) throw new BackupFileError("too-large");
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) throw new BackupFileError("empty");

  const looksLikeJson = trimmed.startsWith("{") || /\.json$/i.test(name);
  if (!looksLikeJson) {
    const { store, skippedRows } = csvToStore(trimmed, { now, current });
    return { format: "csv", scope: "expenses", store, skippedRows };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new BackupFileError("unreadable");
  }
  const envelope = isBackupEnvelope(payload) ? payload : null;
  try {
    return {
      format: "json",
      scope: "all",
      store: normalizeImportedExpenseStore(envelope ? envelope.store : payload),
      exportedAt: envelope && isTimestamp(envelope.exportedAt) ? envelope.exportedAt : undefined,
      skippedRows: 0,
    };
  } catch {
    throw new BackupFileError("not-a-backup");
  }
}

function isBackupEnvelope(
  value: unknown,
): value is { kind: string; store: unknown; exportedAt?: unknown } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === BACKUP_FILE_KIND &&
    "store" in (value as object)
  );
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
