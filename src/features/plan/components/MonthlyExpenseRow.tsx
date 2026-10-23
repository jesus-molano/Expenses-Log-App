"use client";

import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Check, Pencil, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { IconButton } from "@/components/ui/IconButton";
import { SelectMenu } from "@/components/ui/SelectMenu";
import type { PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import { paidAmount } from "@/domain/finance";
import { isOccurrenceOverdue } from "@/domain/pending";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { PaidAmountSuggestion } from "@/features/expenses/components/PaidAmountSuggestion";
import { categoryIconMap } from "@/features/expenses/lib/expense-form-options";
import {
  useMonthlyExpenseRowEditor,
  type MonthlyExpenseUpdateInput,
} from "@/features/plan/hooks/use-monthly-expense-row-editor";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";

export function MonthlyExpenseRow({
  occurrence,
  categories,
  language,
  today,
  skipLabel,
  onSkip,
  onTogglePaid,
  onUpdate,
  suggestPaidAmount,
}: {
  occurrence: ExpenseOccurrence;
  categories: ExpenseCategory[];
  language: AppLanguage;
  today: string;
  skipLabel: string;
  onSkip: () => void;
  onTogglePaid?: () => void;
  onUpdate: (input: MonthlyExpenseUpdateInput) => void;
  // Media de los últimos pagos de la serie, para un recibo variable.
  suggestPaidAmount?: (occurrence: ExpenseOccurrence) => PaidAmountAverage | null;
}) {
  const locale = language === "en" ? enUS : es;
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const editor = useMonthlyExpenseRowEditor({
    occurrence,
    categories,
    language,
    onUpdate,
  });
  // La media de los últimos pagos solo se calcula al editar un cobro pagado.
  const suggestion = useMemo(
    () =>
      editor.editing && editor.status === "paid"
        ? (suggestPaidAmount?.(occurrence) ?? null)
        : null,
    [editor.editing, editor.status, occurrence, suggestPaidAmount],
  );
  const categoryOptions = PRESET_EXPENSE_CATEGORIES.map((category) => {
    const Icon = categoryIconMap[category.icon] ?? WalletCards;

    return {
      value: category.name,
      label: categoryLabel(category.name, language),
      leading: (
        <span
          className="app-monthly-category-menu-icon"
          data-tone={category.tone}
        >
          <Icon size={14} />
        </span>
      ),
    };
  });

  if (editor.editing) {
    return (
      <div
        className="app-list-item app-monthly-table-row app-monthly-table-row-editing grid min-w-0 gap-2 p-3"
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
            aria-label={t("expenses.saveChanges", language)}
            size="sm"
            className="bg-[var(--app-accent)] text-[var(--app-accent-contrast)]"
          >
            <Check size={15} />
          </IconButton>
          <IconButton
            type="button"
            onClick={editor.closeEditor}
            aria-label={t("expenses.close", language)}
            size="sm"
          >
            <X size={15} />
          </IconButton>
        </div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
          <MoneyInput
            value={editor.amount}
            onValueChange={editor.setAmount}
            invalidMessage={t("expenses.amountInvalid", language)}
            blockSubmit={false}
            aria-label={
              editor.status === "paid"
                ? t("bills.plannedField", language)
                : t("expenses.amount", language)
            }
            className="h-11 min-w-0"
          />
          <DatePickerField
            value={editor.dueDate}
            onChange={(value) => editor.setDueDate(value ?? editor.dueDate)}
            label={t("expenses.chargeDate", language)}
            language={language}
            className="h-11 min-w-0"
          />
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold text-[var(--app-text-muted)]">
            {t("expenses.category", language)}
          </p>
          <SelectMenu
            open={categoryMenuOpen}
            onOpenChange={setCategoryMenuOpen}
            value={editor.categoryName}
            options={categoryOptions}
            onChange={editor.setCategoryName}
            align="left"
          />
        </div>
        <div className="app-monthly-status-toggle" role="group">
          {(["due", "paid"] as const).map((status) => {
            const selected = editor.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => editor.setStatus(status)}
                aria-pressed={selected}
                className="app-monthly-status-option min-h-9 px-2 text-sm font-semibold"
                data-status={status}
                data-selected={selected ? "true" : "false"}
              >
                {status === "paid"
                  ? t("common.paid", language)
                  : t("common.pending", language)}
              </button>
            );
          })}
        </div>
        {editor.status === "paid" ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-[var(--app-text-muted)]">
              {t("bills.paidField", language)}
              <MoneyInput
                value={editor.paidAmount}
                onValueChange={editor.setPaidAmount}
                invalidMessage={t("bills.payInvalid", language)}
                blockSubmit={false}
                className="h-11 min-w-0"
              />
            </label>
            {suggestion ? (
              <PaidAmountSuggestion
                suggestion={suggestion}
                language={language}
                onUse={editor.setPaidAmount}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const isPaid = occurrence.status === "paid";
  // Pagado con otro importe: se ve lo pagado y lo previsto al lado.
  const shownAmount = isPaid ? paidAmount(occurrence) : occurrence.template.amount;
  const plannedNote =
    isPaid && shownAmount !== occurrence.template.amount
      ? ` - ${t("bills.plannedHint", language).replace(
          "{amount}",
          formatCurrency(occurrence.template.amount),
        )}`
      : "";
  const isOverdue = isOccurrenceOverdue(occurrence, today);
  const status = isPaid
    ? t("common.paid", language)
    : isOverdue
      ? t("expenses.overdue", language)
      : t("common.pending", language);

  // En movil, dos filas: nombre | importe arriba y detalle | acciones debajo.
  // Son tres columnas (texto, hueco, importe): el nombre ocupa las dos
  // primeras y las acciones las dos ultimas, asi el nombre solo cede el ancho
  // del importe y el detalle el de los botones. Desde sm vuelven a ser las
  // columnas de la tabla.
  return (
    <div
      className="app-list-item app-monthly-table-row app-monthly-expense-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-2 gap-y-1 px-3 py-2 sm:items-center"
      data-has-pay-action={onTogglePaid ? "true" : undefined}
    >
      <div className="contents sm:block sm:min-w-0">
        <p
          className={`col-[1/3] row-start-1 min-w-0 break-words text-sm font-semibold ${
            isPaid
              ? "text-[var(--app-text-subtle)] line-through"
              : "text-[var(--app-text)]"
          }`}
        >
          {occurrence.template.name}
        </p>
        <p className="col-start-1 row-start-2 min-w-0 break-words text-xs font-medium text-[var(--app-text-muted)] sm:mt-0.5">
          {format(new Date(`${occurrence.dueDate}T00:00:00`), "d MMM", {
            locale,
          })}{" "}
          - {categoryLabel(editor.categoryName, language)} - {status}
          {plannedNote}
        </p>
      </div>
      <p
        className={`app-money col-start-3 row-start-1 justify-self-end whitespace-nowrap text-sm font-semibold sm:col-auto sm:row-auto sm:justify-self-auto ${
          isPaid
            ? "text-[var(--app-text-subtle)] line-through"
            : "text-[var(--app-text)]"
        }`}
      >
        {formatCurrency(shownAmount)}
      </p>
      <div className="col-[2/4] row-start-2 flex shrink-0 items-center gap-1 justify-self-end sm:col-auto sm:row-auto sm:justify-self-auto">
        {onTogglePaid ? (
          <IconButton
            type="button"
            onClick={onTogglePaid}
            aria-label={
              language === "es"
                ? `Marcar ${occurrence.template.name} como pagado`
                : `Mark ${occurrence.template.name} as paid`
            }
            title={language === "es" ? "Marcar como pagado" : "Mark as paid"}
            size="touch"
            className="text-[var(--app-success)]"
          >
            <Check size={15} />
          </IconButton>
        ) : null}
        <IconButton
          type="button"
          onClick={editor.openEditor}
          aria-label={t("common.edit", language)}
          size="touch"
        >
          <Pencil size={14} />
        </IconButton>
        <IconButton
          type="button"
          onClick={onSkip}
          aria-label={skipLabel}
          title={skipLabel}
          variant="danger"
          size="touch"
        >
          <X size={15} />
        </IconButton>
      </div>
    </div>
  );
}
