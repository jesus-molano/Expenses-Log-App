"use client";

import { Check, Pencil, X } from "lucide-react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  useIncomeEventRowEditor,
  type IncomeEventUpdateInput,
} from "../hooks/use-income-event-row-editor";

export function IncomeEventRow({
  event,
  language,
  removeLabel,
  onRemove,
  onUpdate,
}: {
  event: IncomeEvent;
  language: AppLanguage;
  removeLabel: string;
  onRemove: () => void;
  onUpdate: (input: IncomeEventUpdateInput) => void;
}) {
  const editor = useIncomeEventRowEditor({ event, language, onUpdate });

  if (editor.editing) {
    return (
      <div
        className="app-list-item app-income-event-row app-income-event-row-editing app-monthly-table-row grid min-w-0 gap-2 p-3"
        data-editing="true"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <input
            value={editor.name}
            onChange={(event) => editor.setName(event.target.value)}
            className="input-control h-11 min-w-0"
          />
          <IconButton
            type="button"
            onClick={editor.save}
            aria-label={t("money.saveIncome", language)}
            size="sm"
            className="bg-[var(--app-accent)] text-[var(--app-accent-contrast)]"
          >
            <Check size={15} />
          </IconButton>
          <IconButton
            type="button"
            onClick={editor.closeEditor}
            aria-label={t("common.close", language)}
            size="sm"
          >
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
          <input
            value={editor.amount}
            inputMode="decimal"
            onChange={(event) => editor.setAmount(event.target.value)}
            className="input-control h-11 min-w-0"
          />
          <DatePickerField
            value={editor.receivedAt}
            onChange={(value) => editor.setReceivedAt(value ?? editor.receivedAt)}
            label={t("money.incomeDate", language)}
            language={language}
            className="h-11 min-w-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-list-item app-income-event-row app-monthly-table-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--app-text)]">
          {event.name}
        </p>
        <p className="text-xs font-medium text-[var(--app-text-muted)]">
          {event.receivedAt}
        </p>
      </div>
      <p className="text-sm font-semibold text-[var(--app-text)]">
        {formatCurrency(event.amount)}
      </p>
      <IconButton
        type="button"
        onClick={editor.openEditor}
        aria-label={t("money.editIncome", language)}
        size="sm"
      >
        <Pencil size={14} />
      </IconButton>
      <IconButton
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        variant="danger"
        size="sm"
      >
        <X size={15} />
      </IconButton>
    </div>
  );
}
