"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/SelectMenu";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput } from "@/shared/money";
import { PlanSheetHeader } from "./PlanSheetHeader";

// Anotar el saldo de una cuenta en una fecha (hoy por defecto). Admite saldos
// negativos; un segundo saldo de la misma cuenta el mismo día sustituye al
// primero.
export function BalanceCheckinSheet({
  language,
  accountOptions,
  accountId,
  date,
  amountText,
  maxDate,
  replacesEntry,
  onAccountChange,
  onDateChange,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  language: AppLanguage;
  // En el orden de la lista de cuentas.
  accountOptions: Array<SelectMenuOption<string>>;
  accountId: string;
  date: string;
  amountText: string;
  maxDate: string;
  replacesEntry: boolean;
  onAccountChange: (accountId: string) => void;
  onDateChange: (date: string) => void;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountName = accountOptions.find((option) => option.value === accountId)?.label ?? "";

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
          <SelectMenu
            open={accountMenuOpen}
            onOpenChange={setAccountMenuOpen}
            value={accountId}
            label={`${t("insights.accounts.account", language)}: ${accountName}`}
            options={accountOptions}
            onChange={onAccountChange}
            align="left"
            keepOrder
          />
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
