"use client";

import { RotateCcw } from "lucide-react";
import type {
  AppLanguage,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  CUSTOM_UNITS,
  MONTHS_EN,
  MONTHS_ES,
  RECURRENCE_OPTIONS,
} from "../../lib/expense-form-options";

type RecurrencePickerProps = {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  language?: AppLanguage;
};

export function RecurrencePicker({
  value,
  onChange,
  language = "es",
}: RecurrencePickerProps) {
  function changeFrequency(frequency: RecurrenceFrequency) {
    if (frequency === "custom") {
      onChange({
        frequency,
        interval: value.interval ?? 2,
        unit: value.unit ?? "month",
      });
      return;
    }

    if (frequency === "yearly") {
      onChange({
        frequency,
        annualMonth: value.annualMonth ?? new Date().getMonth() + 1,
      });
      return;
    }

    onChange({ frequency });
  }

  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <RotateCcw size={17} className="text-cyan-200" />
        {t("expenses.recurrence", language)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RECURRENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeFrequency(option.value)}
            aria-pressed={value.frequency === option.value}
            className={`h-10 rounded-2xl text-sm font-semibold transition ${
              value.frequency === option.value
                ? "bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(190,242,100,0.22)]"
                : "bg-white/[0.055] text-slate-200 hover:bg-white/10"
            }`}
          >
            {t(`expenses.${option.labelKey}`, language)}
          </button>
        ))}
      </div>

      {value.frequency === "custom" ? (
        <CustomIntervalFields value={value} onChange={onChange} language={language} />
      ) : null}

      {value.frequency === "yearly" ? (
        <AnnualMonthFields value={value} onChange={onChange} language={language} />
      ) : null}
    </div>
  );
}

function CustomIntervalFields({
  value,
  onChange,
  language,
}: Required<Pick<RecurrencePickerProps, "value" | "onChange" | "language">>) {
  return (
    <div className="mt-3 grid grid-cols-[6.5rem_1fr] gap-2">
      <input
        inputMode="numeric"
        value={value.interval ?? 1}
        onChange={(event) =>
          onChange({
            ...value,
            interval: Math.max(Number(event.target.value) || 1, 1),
          })
        }
        className="input-control"
        aria-label={t("expenses.recurrenceInterval", language)}
      />
      <div className="grid grid-cols-2 gap-2">
        {CUSTOM_UNITS.map((unit) => (
          <button
            key={unit.value}
            type="button"
            onClick={() => onChange({ ...value, unit: unit.value })}
            aria-pressed={(value.unit ?? "month") === unit.value}
            className={`h-12 rounded-2xl text-sm font-semibold transition ${
              (value.unit ?? "month") === unit.value
                ? "bg-cyan-200 text-slate-950"
                : "bg-white/[0.055] text-slate-200"
            }`}
          >
            {t(`expenses.${unit.labelKey}`, language)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnnualMonthFields({
  value,
  onChange,
  language,
}: Required<Pick<RecurrencePickerProps, "value" | "onChange" | "language">>) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
      {(language === "en" ? MONTHS_EN : MONTHS_ES).map((month, index) => {
        const monthNumber = index + 1;
        return (
          <button
            key={month}
            type="button"
            onClick={() => onChange({ ...value, annualMonth: monthNumber })}
            aria-pressed={(value.annualMonth ?? 1) === monthNumber}
            className={`h-10 rounded-2xl text-sm font-semibold transition ${
              (value.annualMonth ?? 1) === monthNumber
                ? "bg-cyan-200 text-slate-950"
                : "bg-white/[0.055] text-slate-200"
            }`}
          >
            {month}
          </button>
        );
      })}
    </div>
  );
}
