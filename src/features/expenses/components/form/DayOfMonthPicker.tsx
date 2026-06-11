"use client";

import { CalendarDays } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type DayOfMonthPickerProps = {
  value: number;
  onChange: (day: number) => void;
  language?: AppLanguage;
  label?: string;
};

export function DayOfMonthPicker({
  value,
  onChange,
  language = "es",
  label,
}: DayOfMonthPickerProps) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-white">
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={17} className="text-lime-200" />
          {label ?? t("expenses.dueDay", language)}
        </span>
        <span className="rounded-full bg-lime-300/16 px-2.5 py-1 text-xs text-lime-100">
          {t("expenses.dayPrefix", language)} {value}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            aria-pressed={day === value}
            className={`grid h-9 place-items-center rounded-xl text-sm font-semibold transition ${
              day === value
                ? "bg-lime-300 text-slate-950 shadow-[0_0_22px_rgba(190,242,100,0.24)]"
                : "bg-white/[0.045] text-slate-200 hover:bg-white/10"
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
}
