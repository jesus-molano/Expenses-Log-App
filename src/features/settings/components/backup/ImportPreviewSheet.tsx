"use client";

import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import type { ImportMode } from "@/stores/app/backup-commands";
import type { PendingImport } from "../../hooks/use-data-transfer";
import {
  formatBackupDate,
  formatSkippedRows,
  formatStoreSummary,
} from "../../lib/backup-summary";

type ImportPreviewSheetProps = {
  language: AppLanguage;
  pending: PendingImport;
  mode: ImportMode;
  importing: boolean;
  onModeChange: (mode: ImportMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function sourceLabel({ parsed }: PendingImport, language: AppLanguage) {
  if (parsed.format === "csv") return t("backup.previewCsv", language);
  return parsed.exportedAt
    ? formatMessage(
        "backup.previewJson",
        { date: formatBackupDate(parsed.exportedAt, language) },
        language,
      )
    : t("backup.previewJsonUndated", language);
}

export function ImportPreviewSheet({
  language,
  pending,
  mode,
  importing,
  onModeChange,
  onConfirm,
  onCancel,
}: ImportPreviewSheetProps) {
  const { preview, parsed } = pending;

  return (
    <Sheet
      ariaLabelledBy="import-preview-title"
      onBackdropClick={onCancel}
      contentClassName="max-h-[88dvh] sm:max-w-lg"
    >
      <form
        className="grid gap-4 px-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_13%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--app-accent)]">
              <FileUp size={14} />
              {t("backup.importTitle", language)}
            </div>
            <h2
              id="import-preview-title"
              className="mt-2 text-xl font-semibold leading-tight text-[var(--app-text)]"
            >
              {t("backup.previewTitle", language)}
            </h2>
            <p className="mt-1 break-all text-sm font-medium text-[var(--app-text)]">
              {pending.fileName}
            </p>
            <p className="text-xs text-[var(--app-text-muted)]">
              {sourceLabel(pending, language)}
            </p>
          </div>
          <IconButton
            type="button"
            onClick={onCancel}
            disabled={importing}
            aria-label={t("backup.close", language)}
            className="shrink-0"
          >
            <X size={18} />
          </IconButton>
        </header>

        <div className="app-inline-panel grid gap-1 p-3 text-sm">
          <p>
            {formatMessage(
              "backup.previewContains",
              { summary: formatStoreSummary(preview.file, language) },
              language,
            )}
          </p>
          {parsed.skippedRows > 0 ? (
            <p className="text-xs font-semibold text-[var(--app-warning)]">
              {formatSkippedRows(parsed.skippedRows, language)}
            </p>
          ) : null}
        </div>

        <fieldset className="grid gap-2" disabled={importing}>
          <legend className="mb-2 px-1 text-xs font-semibold text-[var(--app-text-muted)]">
            {t("backup.modeLabel", language)}
          </legend>
          <ImportModeOption
            value="merge"
            selected={mode === "merge"}
            title={t("backup.modeMerge", language)}
            help={t("backup.modeMergeHelp", language)}
            result={formatMessage(
              "backup.modeResult",
              { summary: formatStoreSummary(preview.merge, language) },
              language,
            )}
            onSelect={onModeChange}
          />
          <ImportModeOption
            value="replace"
            tone="danger"
            selected={mode === "replace"}
            title={t("backup.modeReplace", language)}
            help={t(
              parsed.scope === "all" ? "backup.modeReplaceHelp" : "backup.modeReplaceCsvHelp",
              language,
            )}
            result={formatMessage(
              "backup.modeResult",
              { summary: formatStoreSummary(preview.replace, language) },
              language,
            )}
            onSelect={onModeChange}
          />
        </fieldset>

        <p className="px-1 text-xs text-[var(--app-text-muted)]">
          {t("backup.safetyNote", language)}
        </p>

        <div className="app-sheet-footer sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={importing}>
            {t("backup.cancel", language)}
          </Button>
          <Button
            type="submit"
            variant={mode === "replace" ? "danger" : "primary"}
            disabled={importing}
          >
            {importing
              ? t("backup.importing", language)
              : t(
                  mode === "replace" ? "backup.importReplaceConfirm" : "backup.importConfirm",
                  language,
                )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function ImportModeOption({
  value,
  selected,
  tone,
  title,
  help,
  result,
  onSelect,
}: {
  value: ImportMode;
  selected: boolean;
  tone?: "danger";
  title: string;
  help: string;
  result: string;
  onSelect: (mode: ImportMode) => void;
}) {
  return (
    <label
      className="app-choice-card flex items-start gap-3 p-3"
      data-selected={selected}
      data-tone={tone}
    >
      <input
        type="radio"
        name="import-mode"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--app-text)]">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{help}</span>
        <span className="mt-1 block text-xs font-semibold text-[var(--app-text)]">
          {result}
        </span>
      </span>
    </label>
  );
}
