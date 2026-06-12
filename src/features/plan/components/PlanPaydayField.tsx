"use client";

import { CalendarDays, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";

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
  useBodyScrollLock(open, { strategy: "fixed" });

  function selectDay(day: number) {
    onSalaryDayChange(day);
    onOpenChange(false);
  }

  const label = t("money.payday", language);
  const pickerDialog = open ? (
    <div
      className="app-sheet-backdrop app-datepicker-backdrop z-[80] animate-[fade-in_180ms_ease-out]"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="app-dialog animate-[slide-up-soft_220ms_cubic-bezier(0.22,1,0.36,1)] p-4 sm:max-w-sm"
        style={{ backgroundColor: "var(--app-surface-strong)" }}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--app-text)]">
              {label}
            </h3>
            <p className="mt-0.5 text-sm font-medium text-[var(--app-text-muted)]">
              {t("money.selectPayday", language)}
            </p>
          </div>
          <IconButton
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("common.close", language)}
            size="sm"
          >
            <X size={16} />
          </IconButton>
        </header>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
            const selected = day === salaryDay;

            return (
              <button
                key={day}
                type="button"
                onClick={() => selectDay(day)}
                aria-pressed={selected}
                className={cn(
                  "app-control grid aspect-square min-h-10 place-items-center rounded-[var(--app-radius-md)] text-sm font-semibold",
                  selected ? "app-chip-selected" : "text-[var(--app-text)]",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        <footer className="mt-4">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            variant="secondary"
            className="w-full"
          >
            {t("common.close", language)}
          </Button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <Field label={label}>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="input-control flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-label={`${t("money.changePaydayLabel", language)}, ${salaryDay}`}
      >
        <span className="min-w-0 truncate">
          {label} {salaryDay}
        </span>
        <CalendarDays size={18} className="shrink-0 text-[var(--app-accent)]" />
      </button>

      {typeof document !== "undefined" && pickerDialog
        ? createPortal(pickerDialog, document.body)
        : null}
    </Field>
  );
}
