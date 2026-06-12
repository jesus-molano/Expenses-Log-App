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
    <Sheet
      ariaLabel={t("money.editMonthSavings", language)}
      contentClassName="sm:max-w-sm"
      onBackdropClick={onClose}
    >
      <form onSubmit={onSubmit} className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">
              {t("money.editMonthSavings", language)}
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
