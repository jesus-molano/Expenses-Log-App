"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type MonthlySavingsTargetDialogProps = {
  language: AppLanguage;
  monthLabel: string;
  amount: string;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MonthlySavingsTargetDialog({
  language,
  monthLabel,
  amount,
  onAmountChange,
  onClose,
  onSubmit,
}: MonthlySavingsTargetDialogProps) {
  return (
    <Sheet contentClassName="sm:max-w-sm">
      <form onSubmit={onSubmit} className="p-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--app-panel-soft-alpha)] sm:hidden" />
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">
              {t("money.editMonthSavings", language)}
            </h2>
            <p className="mt-1 text-sm font-medium capitalize text-[var(--app-text-muted)]">
              {monthLabel}
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

        <Field
          label={t("money.monthlySavings", language)}
          className="mt-5"
        >
          <input
            value={amount}
            inputMode="decimal"
            placeholder="300,00"
            onChange={(event) => onAmountChange(event.target.value)}
            className="input-control"
            autoFocus
          />
        </Field>

        <Button type="submit" variant="primary" className="mt-5 w-full">
          {t("money.saveMonthSavings", language)}
        </Button>
      </form>
    </Sheet>
  );
}
