"use client";

import type { FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type AccountNames = {
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

type PlanSettingsSheetProps = {
  language: AppLanguage;
  salaryAmount: string;
  salaryDay: number;
  savingsTarget: string;
  accountNames: AccountNames;
  dayPickerOpen: boolean;
  onSalaryAmountChange: (value: string) => void;
  onSalaryDayChange: (value: number) => void;
  onSavingsTargetChange: (value: string) => void;
  onAccountNamesChange: (value: AccountNames) => void;
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
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">
              {t("money.configureMoney", language)}
            </h2>
            <p className="text-sm text-[var(--app-text-muted)]">
              {t("money.configureMoneySubtitle", language)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-3 text-sm font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-panel-soft-alpha)]"
          >
            {t("money.close", language)}
          </button>
        </header>

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

          <Field label={t("money.payday", language)}>
            <button
              type="button"
              onClick={() => onDayPickerOpenChange(!dayPickerOpen)}
              className="input-control flex items-center justify-between text-left"
              aria-expanded={dayPickerOpen}
              aria-label={`${t("money.changePaydayLabel", language)}, ${salaryDay}`}
            >
              <span>
                {t("money.payday", language)} {salaryDay}
              </span>
              <span className="text-xs font-semibold text-[var(--app-accent)]">
                {t("money.changePayday", language)}
              </span>
            </button>
            {dayPickerOpen ? (
              <div className="rounded-[1rem] border border-[var(--app-border)] bg-[var(--app-panel-soft-alpha)] p-2 shadow-[var(--app-shadow)]">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, index) => index + 1).map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          onSalaryDayChange(day);
                          onDayPickerOpenChange(false);
                        }}
                        className={`grid h-9 place-items-center rounded-xl text-sm font-semibold transition ${
                          day === salaryDay
                            ? "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_0_20px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]"
                            : "bg-[var(--app-panel-soft-alpha)] text-[var(--app-text)] hover:bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
                        }`}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </Field>

          <Field label={t("money.monthlySavings", language)}>
            <input
              value={savingsTarget}
              inputMode="decimal"
              placeholder="300,00"
              onChange={(event) => onSavingsTargetChange(event.target.value)}
              className="input-control"
            />
          </Field>

          <Field label={t("money.expensesAccount", language)}>
            <input
              value={accountNames.expensesAccountName}
              onChange={(event) =>
                onAccountNamesChange({
                  ...accountNames,
                  expensesAccountName: event.target.value,
                })
              }
              className="input-control"
            />
          </Field>

          <Field label={t("money.savingsAccount", language)}>
            <input
              value={accountNames.savingsAccountName}
              onChange={(event) =>
                onAccountNamesChange({
                  ...accountNames,
                  savingsAccountName: event.target.value,
                })
              }
              className="input-control"
            />
          </Field>

          <Field label={t("money.mainAccount", language)}>
            <input
              value={accountNames.primaryAccountName}
              onChange={(event) =>
                onAccountNamesChange({
                  ...accountNames,
                  primaryAccountName: event.target.value,
                })
              }
              className="input-control"
            />
          </Field>
        </div>

        <button className="mt-5 h-12 w-full rounded-2xl bg-[var(--app-accent)] text-sm font-semibold text-[var(--app-accent-contrast)]">
          {t("money.saveSettings", language)}
        </button>
      </form>
    </Sheet>
  );
}

