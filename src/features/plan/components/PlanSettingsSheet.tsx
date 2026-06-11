"use client";

import type { FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { PlanAccountNames } from "../types";
import { PlanAccountFields } from "./PlanAccountFields";
import { PlanPaydayField } from "./PlanPaydayField";
import { PlanSettingsHeader } from "./PlanSettingsHeader";

type PlanSettingsSheetProps = {
  language: AppLanguage;
  salaryAmount: string;
  salaryDay: number;
  savingsTarget: string;
  accountNames: PlanAccountNames;
  dayPickerOpen: boolean;
  onSalaryAmountChange: (value: string) => void;
  onSalaryDayChange: (value: number) => void;
  onSavingsTargetChange: (value: string) => void;
  onAccountNamesChange: (value: PlanAccountNames) => void;
  onDayPickerOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlanSettingsSheet({
  language,
  salaryAmount,
  salaryDay,
  savingsTarget,
  accountNames,
  dayPickerOpen,
  onSalaryAmountChange,
  onSalaryDayChange,
  onSavingsTargetChange,
  onAccountNamesChange,
  onDayPickerOpenChange,
  onClose,
  onSubmit,
}: PlanSettingsSheetProps) {
  return (
    <Sheet>
      <form onSubmit={onSubmit} className="p-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--app-panel-soft-alpha)] sm:hidden" />
        <PlanSettingsHeader language={language} onClose={onClose} />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("money.salary", language)}>
            <input
              value={salaryAmount}
              inputMode="decimal"
              placeholder="2.200,00"
              onChange={(event) => onSalaryAmountChange(event.target.value)}
              className="input-control"
            />
          </Field>

          <PlanPaydayField
            language={language}
            salaryDay={salaryDay}
            open={dayPickerOpen}
            onOpenChange={onDayPickerOpenChange}
            onSalaryDayChange={onSalaryDayChange}
          />

          <Field label={t("money.monthlySavings", language)}>
            <input
              value={savingsTarget}
              inputMode="decimal"
              placeholder="300,00"
              onChange={(event) => onSavingsTargetChange(event.target.value)}
              className="input-control"
            />
          </Field>

          <PlanAccountFields
            language={language}
            accountNames={accountNames}
            onAccountNamesChange={onAccountNamesChange}
          />
        </div>

        <button className="mt-5 h-12 w-full rounded-2xl bg-[var(--app-accent)] text-sm font-semibold text-[var(--app-accent-contrast)]">
          {t("money.saveSettings", language)}
        </button>
      </form>
    </Sheet>
  );
}

