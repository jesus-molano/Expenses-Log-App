"use client";

import { Check, Pencil, X } from "lucide-react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  useIncomeEventRowEditor,
  type IncomeEventUpdateInput,
} from "../hooks/use-income-event-row-editor";
import { formatShortDate } from "../lib/plan-dashboard";

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
          <MoneyInput
            value={editor.amount}
            onValueChange={editor.setAmount}
            invalidMessage={t("expenses.amountInvalid", language)}
            blockSubmit={false}
            aria-label={t("expenses.amount", language)}
            className="h-11 min-w-0"
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

  // En movil, igual que MonthlyExpenseRow: nombre | importe arriba y fecha |
  // acciones debajo, con tres columnas para que el nombre solo ceda el ancho
  // del importe. Desde sm vuelven a ser las cuatro columnas de la tabla.
  return (
    <div className="app-list-item app-income-event-row app-monthly-table-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
      <div className="contents sm:block sm:min-w-0">
        <p className="col-[1/3] row-start-1 min-w-0 break-words text-sm font-semibold text-[var(--app-text)]">
          {event.name}
        </p>
        <p className="col-start-1 row-start-2 text-xs font-medium text-[var(--app-text-muted)]">
          {formatShortDate(event.receivedAt, language)}
        </p>
      </div>
      <p className="app-money col-start-3 row-start-1 justify-self-end whitespace-nowrap text-sm font-semibold text-[var(--app-text)] sm:col-auto sm:row-auto sm:justify-self-auto">
        {formatCurrency(event.amount)}
      </p>
      <div className="col-[2/4] row-start-2 flex items-center gap-2 justify-self-end sm:contents">
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
    </div>
  );
}
