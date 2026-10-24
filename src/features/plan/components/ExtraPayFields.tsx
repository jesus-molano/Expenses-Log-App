"use client";

import { useId } from "react";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type ExtraPayFieldsProps = {
  months: number[];
  amount: string;
  language: AppLanguage;
  onToggleMonth: (month: number) => void;
  onAmountChange: (value: string) => void;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

// Pagas extra: los meses en los que llega una paga más y su importe (vacío,
// un sueldo más).
export function ExtraPayFields({
  months,
  amount,
  language,
  onToggleMonth,
  onAmountChange,
}: ExtraPayFieldsProps) {
  const titleId = useId();
  const locale = language === "en" ? enUS : es;

  return (
    <fieldset className="grid gap-3 sm:col-span-2" aria-labelledby={titleId}>
      <div className="grid gap-0.5">
        <p id={titleId} className="text-sm font-semibold text-[var(--app-text-muted)]">
          {t("salary.extraPayTitle", language)}
        </p>
        <p className="text-xs text-[var(--app-text-muted)]">
          {t("salary.extraPayHelp", language)}
        </p>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {MONTHS.map((month) => {
          const date = new Date(2026, month - 1, 1);
          const selected = months.includes(month);
          return (
            <button
              key={month}
              type="button"
              aria-pressed={selected}
              aria-label={format(date, "LLLL", { locale })}
              data-selected={selected ? "true" : "false"}
              onClick={() => onToggleMonth(month)}
              className="app-control app-focus-ring min-h-11 px-1 text-xs font-semibold capitalize"
            >
              {format(date, "LLL", { locale }).replace(".", "")}
            </button>
          );
        })}
      </div>
      {months.length ? (
        <Field
          label={t("salary.extraPayAmount", language)}
          hint={t("salary.extraPayAmountHint", language)}
        >
          <MoneyInput
            value={amount}
            onValueChange={onAmountChange}
            allowZero
            invalidMessage={t("money.amountInvalid", language)}
            optional
          />
        </Field>
      ) : null}
    </fieldset>
  );
}
