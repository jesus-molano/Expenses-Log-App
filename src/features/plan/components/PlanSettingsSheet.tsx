import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { ExtraPayFields } from "./ExtraPayFields";
import { PlanPaydayField } from "./PlanPaydayField";
import { PlanSettingsHeader } from "./PlanSettingsHeader";

type PlanSettingsSheetProps = {
  language: AppLanguage;
  salaryAmount: string;
  salaryDay: number;
  savingsTarget: string;
  dayPickerOpen: boolean;
  extraPayMonths: number[];
  extraPayAmount: string;
  onToggleExtraPayMonth: (month: number) => void;
  onExtraPayAmountChange: (value: string) => void;
  onSalaryAmountChange: (value: string) => void;
  onSalaryDayChange: (value: number) => void;
  onSavingsTargetChange: (value: string) => void;
  onDayPickerOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlanSettingsSheet({
  language,
  salaryAmount,
  salaryDay,
  savingsTarget,
  dayPickerOpen,
  extraPayMonths,
  extraPayAmount,
  onToggleExtraPayMonth,
  onExtraPayAmountChange,
  onSalaryAmountChange,
  onSalaryDayChange,
  onSavingsTargetChange,
  onDayPickerOpenChange,
  onClose,
  onSubmit,
}: PlanSettingsSheetProps) {
  return (
    <Sheet
      ariaLabel={t("money.configureMoney", language)}
      onBackdropClick={onClose}
    >
      <form onSubmit={onSubmit} className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <PlanSettingsHeader language={language} onClose={onClose} />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("money.salary", language)}>
            <MoneyInput
              value={salaryAmount}
              allowZero
              placeholder="2.200,00"
              onValueChange={onSalaryAmountChange}
              invalidMessage={t("money.amountInvalid", language)}
            />
          </Field>

          <PlanPaydayField
            language={language}
            salaryDay={salaryDay}
            open={dayPickerOpen}
            onOpenChange={onDayPickerOpenChange}
            onSalaryDayChange={onSalaryDayChange}
          />

          <Field
            label={t("money.savingsTarget", language)}
            className="sm:col-span-2"
          >
            <MoneyInput
              value={savingsTarget}
              allowZero
              placeholder="300,00"
              onValueChange={onSavingsTargetChange}
              invalidMessage={t("money.amountInvalid", language)}
            />
          </Field>

          <ExtraPayFields
            months={extraPayMonths}
            amount={extraPayAmount}
            language={language}
            onToggleMonth={onToggleExtraPayMonth}
            onAmountChange={onExtraPayAmountChange}
          />
        </div>

        <Button type="submit" className="mt-5 w-full" variant="primary" size="lg">
          {t("money.saveSettings", language)}
        </Button>
      </form>
    </Sheet>
  );
}
