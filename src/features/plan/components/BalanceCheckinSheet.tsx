import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput } from "@/shared/money";
import { PlanSheetHeader } from "./PlanSheetHeader";

// Anotar el saldo de la cuenta en una fecha (hoy por defecto). Admite saldos
// negativos; un segundo saldo el mismo día sustituye al primero.
export function BalanceCheckinSheet({
  language,
  date,
  amountText,
  maxDate,
  replacesEntry,
  onDateChange,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  language: AppLanguage;
  date: string;
  amountText: string;
  maxDate: string;
  replacesEntry: boolean;
  onDateChange: (date: string) => void;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Sheet
      ariaLabelledBy="balance-checkin-title"
      onBackdropClick={onClose}
      contentClassName="sm:max-w-sm"
    >
      <form onSubmit={onSubmit} className="p-5">
        <PlanSheetHeader
          title={t("insights.balance.record", language)}
          titleId="balance-checkin-title"
          onClose={onClose}
          language={language}
        />
        <div className="mt-5 grid gap-3">
          <Field label={t("insights.balance.amount", language)}>
            <MoneyInput
              value={amountText}
              allowNegative
              autoComplete="off"
              placeholder={formatMoneyInput(1250.4, language)}
              onValueChange={onAmountChange}
              invalidMessage={t("insights.balance.invalid", language)}
            />
          </Field>
          <div className="grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
            <span>{t("insights.balance.date", language)}</span>
            <DatePickerField
              value={date}
              onChange={(value) => onDateChange(value ?? date)}
              label={t("insights.balance.date", language)}
              language={language}
              max={maxDate}
            />
          </div>
          {replacesEntry ? (
            <p className="text-xs text-[var(--app-text-muted)]" role="status">
              {t("insights.balance.replaceHint", language)}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="primary" className="mt-5 w-full">
          {t("insights.balance.save", language)}
        </Button>
      </form>
    </Sheet>
  );
}
