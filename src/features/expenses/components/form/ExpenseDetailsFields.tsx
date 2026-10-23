import { ChevronDown, FileText } from "lucide-react";
import { useId, useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Surface } from "@/components/ui/Surface";
import {
  CANCELLATION_URL_MAX_LENGTH,
  EXPENSE_DETAIL_KEYS,
  EXPENSE_NOTES_MAX_LENGTH,
  PAYMENT_METHODS,
  PAYMENT_METHOD_DETAIL_MAX_LENGTH,
  isValidCancellationUrlInput,
} from "@/domain/expense-details";
import type { AppLanguage, DraftExpense, PaymentMethod } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";
import { paymentMethodName } from "../../lib/expense-detail-labels";
import { ExpenseField } from "./ExpenseField";

type ExpenseDetailsFieldsProps = {
  value: DraftExpense;
  language: AppLanguage;
  onChange: (value: DraftExpense) => void;
};

// Notas, método de pago, permanencia y enlace de baja. Plegado por defecto
// para no alargar el alta; se abre solo si el gasto ya tiene alguno.
export function ExpenseDetailsFields({ value, language, onChange }: ExpenseDetailsFieldsProps) {
  const [open, setOpen] = useState(() => EXPENSE_DETAIL_KEYS.some((key) => Boolean(value[key])));
  const panelId = useId();
  const urlInvalid = !isValidCancellationUrlInput(value.cancellationUrl ?? "");

  function setMethod(method: PaymentMethod) {
    onChange({
      ...value,
      // Tocar el método elegido lo quita.
      paymentMethod: value.paymentMethod === method ? undefined : method,
    });
  }

  return (
    <Surface as="section" variant="section" padding="sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="app-focus-ring flex w-full items-start justify-between gap-3 rounded-[var(--app-radius-md)] text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
            <FileText size={17} className="text-[var(--app-accent)]" />
            {t("expenseDetails.section", language)}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--app-text-muted)]">
            {t("expenseDetails.sectionHint", language)}
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn("mt-0.5 shrink-0 text-[var(--app-text-muted)] transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div id={panelId} className="mt-4 grid gap-4">
          <ExpenseField label={t("expenseDetails.notes", language)} optional language={language}>
            <textarea
              value={value.notes ?? ""}
              maxLength={EXPENSE_NOTES_MAX_LENGTH}
              rows={3}
              onChange={(event) => onChange({ ...value, notes: event.target.value })}
              className="input-control min-h-24 py-2"
              placeholder={t("expenseDetails.notesPlaceholder", language)}
            />
          </ExpenseField>

          <div className="grid gap-1.5">
            <p className="text-sm font-semibold text-[var(--app-text-muted)]">
              {t("expenseDetails.paymentMethod", language)}
            </p>
            <div
              role="group"
              aria-label={t("expenseDetails.paymentMethod", language)}
              className="grid grid-cols-2 gap-1.5 min-[430px]:grid-cols-4"
            >
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={value.paymentMethod === method}
                  onClick={() => setMethod(method)}
                  className="app-control min-h-10 px-2 text-xs font-bold"
                >
                  {paymentMethodName(method, language)}
                </button>
              ))}
            </div>
          </div>

          {value.paymentMethod ? (
            <ExpenseField label={t("expenseDetails.paymentDetail", language)} optional language={language}>
              <input
                value={value.paymentMethodDetail ?? ""}
                maxLength={PAYMENT_METHOD_DETAIL_MAX_LENGTH}
                autoComplete="off"
                onChange={(event) => onChange({ ...value, paymentMethodDetail: event.target.value })}
                className="input-control"
                placeholder={t("expenseDetails.paymentDetailPlaceholder", language)}
              />
            </ExpenseField>
          ) : null}

          <ExpenseField label={t("expenseDetails.commitmentEnd", language)} optional language={language}>
            <DatePickerField
              value={value.commitmentEndDate ?? ""}
              onChange={(commitmentEndDate) =>
                onChange({ ...value, commitmentEndDate: commitmentEndDate || undefined })
              }
              label={t("expenseDetails.commitmentEnd", language)}
              language={language}
              allowClear
            />
          </ExpenseField>
          <p className="-mt-2 text-xs text-[var(--app-text-muted)]">
            {t("expenseDetails.commitmentHelp", language)}
          </p>

          <ExpenseField label={t("expenseDetails.cancellationUrl", language)} optional language={language}>
            <input
              value={value.cancellationUrl ?? ""}
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={CANCELLATION_URL_MAX_LENGTH}
              onChange={(event) => onChange({ ...value, cancellationUrl: event.target.value })}
              ref={(input) =>
                input?.setCustomValidity(
                  urlInvalid ? t("expenseDetails.cancellationUrlInvalid", language) : "",
                )
              }
              aria-invalid={urlInvalid || undefined}
              className="input-control"
              placeholder={t("expenseDetails.cancellationUrlPlaceholder", language)}
            />
          </ExpenseField>
          {urlInvalid ? (
            <p role="alert" className="-mt-2 text-xs font-semibold text-[var(--app-danger)]">
              {t("expenseDetails.cancellationUrlInvalid", language)}
            </p>
          ) : null}
        </div>
      ) : null}
    </Surface>
  );
}
