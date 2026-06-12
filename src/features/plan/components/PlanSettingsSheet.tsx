"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage, PlanAccount } from "@/domain/types";
import { t } from "@/shared/i18n";
import { PlanAccountFields } from "./PlanAccountFields";
import { PlanPaydayField } from "./PlanPaydayField";
import { PlanSettingsHeader } from "./PlanSettingsHeader";

type PlanSettingsSheetProps = {
  language: AppLanguage;
  salaryAmount: string;
  salaryDay: number;
  savingsTarget: string;
  accounts: PlanAccount[];
  dayPickerOpen: boolean;
  onSalaryAmountChange: (value: string) => void;
  onSalaryDayChange: (value: number) => void;
  onSavingsTargetChange: (value: string) => void;
  onAccountsChange: (value: PlanAccount[]) => void;
  onDayPickerOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlanSettingsSheet({
  language,
  salaryAmount,
  salaryDay,
  savingsTarget,
  accounts,
  dayPickerOpen,
  onSalaryAmountChange,
  onSalaryDayChange,
  onSavingsTargetChange,
  onAccountsChange,
  onDayPickerOpenChange,
  onClose,
  onSubmit,
}: PlanSettingsSheetProps) {
  return (
    <Sheet onBackdropClick={onClose}>
      <form onSubmit={onSubmit} className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
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
            accounts={accounts}
            onAccountsChange={onAccountsChange}
          />
        </div>

        <Button type="submit" className="mt-5 w-full" variant="primary" size="lg">
          {t("money.saveSettings", language)}
        </Button>
      </form>
    </Sheet>
  );
}

