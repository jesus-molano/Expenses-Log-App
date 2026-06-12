"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { PlanPaydayField } from "./PlanPaydayField";

type MonthlySalaryDialogProps = {
  language: AppLanguage;
  monthLabel: string;
  amount: string;
  salaryDay: number;
  dayPickerOpen: boolean;
  onAmountChange: (value: string) => void;
  onSalaryDayChange: (value: number) => void;
  onDayPickerOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MonthlySalaryDialog({
  language,
  monthLabel,
  amount,
  salaryDay,
  dayPickerOpen,
  onAmountChange,
  onSalaryDayChange,
  onDayPickerOpenChange,
  onClose,
  onSubmit,
}: MonthlySalaryDialogProps) {
  return (
    <Sheet contentClassName="sm:max-w-sm">
      <form onSubmit={onSubmit} className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">
              {t("money.editMonthSalary", language)}
            </h2>
            <p className="mt-1 text-sm font-medium capitalize text-[var(--app-text-muted)]">
              {monthLabel}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="rounded-full"
          >
            {t("money.close", language)}
          </Button>
        </header>

        <div className="mt-5 grid gap-3">
          <Field label={t("money.salary", language)}>
            <input
              value={amount}
              inputMode="decimal"
              placeholder="2.200,00"
              onChange={(event) => onAmountChange(event.target.value)}
              className="input-control"
              autoFocus
            />
          </Field>

          <PlanPaydayField
            language={language}
            salaryDay={salaryDay}
            open={dayPickerOpen}
            onOpenChange={onDayPickerOpenChange}
            onSalaryDayChange={onSalaryDayChange}
          />
        </div>

        <Button type="submit" variant="primary" className="mt-5 w-full">
          {t("money.saveMonthSalary", language)}
        </Button>
      </form>
    </Sheet>
  );
}
