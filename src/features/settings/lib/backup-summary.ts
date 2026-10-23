import type { BackupFileErrorCode } from "@/data/persistence/backup-errors";
import type { ParsedBackup } from "@/data/persistence/backup-file";
import type { SnapshotReason } from "@/data/persistence/snapshot-policy";
import { summarizeStore, type StoreSummary } from "@/domain/store-summary";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { formatMessage, t, type TranslationKey } from "@/shared/i18n";
import { importStoreInStore } from "@/stores/app/backup-commands";

export type ImportPreview = {
  file: StoreSummary;
  merge: StoreSummary;
  replace: StoreSummary;
};

// Cuánto quedaría con cada forma de importar, para decidir antes de tocar nada.
export function previewImport(
  current: ExpenseStore,
  parsed: Pick<ParsedBackup, "store" | "scope">,
  now = new Date(),
): ImportPreview {
  const options = { scope: parsed.scope, now };
  return {
    file: summarizeStore(parsed.store),
    merge: summarizeStore(
      importStoreInStore(current, parsed.store, { ...options, mode: "merge" }),
    ),
    replace: summarizeStore(
      importStoreInStore(current, parsed.store, { ...options, mode: "replace" }),
    ),
  };
}

function countLabel(
  count: number,
  one: TranslationKey,
  many: TranslationKey,
  language: AppLanguage,
) {
  return count === 1 ? t(one, language) : formatMessage(many, { count }, language);
}

// "18 gastos · 42 pagos · 3 ingresos"
export function formatStoreSummary(summary: StoreSummary, language: AppLanguage) {
  return [
    countLabel(summary.expenses, "backup.summaryExpensesOne", "backup.summaryExpensesMany", language),
    countLabel(summary.payments, "backup.summaryPaymentsOne", "backup.summaryPaymentsMany", language),
    countLabel(summary.incomeEvents, "backup.summaryIncomeOne", "backup.summaryIncomeMany", language),
  ].join(" · ");
}

export function formatSkippedRows(count: number, language: AppLanguage) {
  return countLabel(count, "backup.previewSkippedOne", "backup.previewSkippedMany", language);
}

export function formatSnapshotsSummary(
  count: number,
  latestAt: string,
  language: AppLanguage,
) {
  return formatMessage(
    count === 1 ? "backup.snapshotsSummaryOne" : "backup.snapshotsSummaryMany",
    { count, date: formatBackupDate(latestAt, language) },
    language,
  );
}

// "23 oct, 09:12"
export function formatBackupDate(iso: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// "1,2 MB"
export function formatStorageSize(bytes: number, language: AppLanguage) {
  const megabytes = bytes / (1024 * 1024);
  const [value, unit] =
    megabytes >= 1 ? [megabytes, "megabyte"] : [Math.max(bytes / 1024, 0), "kilobyte"];
  return new Intl.NumberFormat(language === "en" ? "en-GB" : "es-ES", {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

const SNAPSHOT_REASON_KEYS: Record<SnapshotReason, TranslationKey> = {
  daily: "backup.reasonDaily",
  "before-import": "backup.reasonBeforeImport",
  "before-restore": "backup.reasonBeforeRestore",
  "before-clear": "backup.reasonBeforeClear",
  manual: "backup.reasonManual",
};

export function snapshotReasonLabel(reason: SnapshotReason, language: AppLanguage) {
  return t(SNAPSHOT_REASON_KEYS[reason], language);
}

const IMPORT_ERROR_KEYS: Record<BackupFileErrorCode, TranslationKey> = {
  empty: "backup.importErrorEmpty",
  "too-large": "backup.importErrorTooLarge",
  unreadable: "backup.importErrorUnreadable",
  "not-a-backup": "backup.importErrorNotBackup",
  "csv-columns": "backup.importErrorColumns",
  "csv-no-rows": "backup.importErrorNoRows",
};

export function importErrorMessage(code: BackupFileErrorCode, language: AppLanguage) {
  return t(IMPORT_ERROR_KEYS[code], language);
}
