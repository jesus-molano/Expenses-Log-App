"use client";

import { Field } from "@/components/ui/Field";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PlanPaydayFieldProps = {
  language: AppLanguage;
  salaryDay: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalaryDayChange: (value: number) => void;
};

export function PlanPaydayField({
  language,
  salaryDay,
  open,
  onOpenChange,
  onSalaryDayChange,
}: PlanPaydayFieldProps) {
  return (
    <Field label={t("money.payday", language)}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="input-control flex items-center justify-between text-left"
        aria-expanded={open}
        aria-label={`${t("money.changePaydayLabel", language)}, ${salaryDay}`}
      >
        <span>
          {t("money.payday", language)} {salaryDay}
        </span>
        <span className="text-xs font-semibold text-[var(--app-accent)]">
          {t("money.changePayday", language)}
        </span>
      </button>

      {open ? (
        <div className="rounded-[1rem] border border-[var(--app-border)] bg-[var(--app-panel-soft-alpha)] p-2 shadow-[var(--app-shadow)]">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onSalaryDayChange(day);
                  onOpenChange(false);
                }}
                className={`grid h-9 place-items-center rounded-xl text-sm font-semibold transition ${
                  day === salaryDay
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_0_20px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]"
                    : "bg-[var(--app-panel-soft-alpha)] text-[var(--app-text)] hover:bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Field>
  );
}
