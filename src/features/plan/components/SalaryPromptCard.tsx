"use client";

import type { FormEvent } from "react";
import { useId } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { SalaryPrompt } from "@/domain/budget-month";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { formatMonthName } from "@/features/expenses/lib/month-view";
import { t } from "@/shared/i18n";

type SalaryPromptCardProps = {
  prompt: SalaryPrompt;
  editing: boolean;
  amountText: string;
  language: AppLanguage;
  onConfirm: () => void;
  onStartOther: () => void;
  onCancelOther: () => void;
  onAmountTextChange: (value: string) => void;
  onSaveOther: (event: FormEvent<HTMLFormElement>) => void;
  onDismiss: () => void;
};

// "¿Has cobrado la nómina de octubre?" el día de cobro. Lo cobrado pasa a ser
// el sueldo real del mes en Mes.
export function SalaryPromptCard({
  prompt,
  editing,
  amountText,
  language,
  onConfirm,
  onStartOther,
  onCancelOther,
  onAmountTextChange,
  onSaveOther,
  onDismiss,
}: SalaryPromptCardProps) {
  const titleId = useId();
  const expected = (
    prompt.extraPayAmount > 0
      ? t("salary.promptExpectedExtra", language)
      : t("salary.promptExpected", language)
  ).replace("{amount}", formatCurrency(prompt.expectedAmount));

  return (
    <section aria-labelledby={titleId} className="app-section-card grid gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]">
          <HandCoins size={18} aria-hidden="true" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2 id={titleId} className="text-sm font-semibold text-[var(--app-text)]">
            {t("salary.promptTitle", language).replace(
              "{month}",
              formatMonthName(prompt.monthId, language),
            )}
          </h2>
          <p className="app-money text-xs text-[var(--app-text-muted)]">{expected}</p>
        </div>
      </div>

      {editing ? (
        <form onSubmit={onSaveOther} className="grid gap-2">
          <Field label={t("salary.promptAmount", language)}>
            <MoneyInput
              value={amountText}
              onValueChange={onAmountTextChange}
              invalidMessage={t("bills.payInvalid", language)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={onCancelOther}>
              {t("common.back", language)}
            </Button>
            <Button type="submit" variant="primary">
              {t("salary.promptSave", language)}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={onConfirm}>
            {t("salary.promptYes", language)}
          </Button>
          <Button type="button" variant="secondary" onClick={onStartOther}>
            {t("salary.promptOther", language)}
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            {t("salary.promptNotYet", language)}
          </Button>
        </div>
      )}
    </section>
  );
}
