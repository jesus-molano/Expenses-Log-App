"use client";

import {
  CalendarDays,
  Car,
  CreditCard,
  Gamepad2,
  HeartPulse,
  Home,
  RotateCcw,
  Sparkles,
  User,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  PRESET_EXPENSE_CATEGORIES,
  PRESET_EXPENSE_TAGS,
} from "@/domain/categories";
import type {
  CustomRecurrenceUnit,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/domain/types";
import { categoryToneClass } from "../lib/expense-actions";

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const RECURRENCE_OPTIONS: Array<{
  value: RecurrenceFrequency;
  label: string;
}> = [
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
  { value: "custom", label: "Custom" },
];

const CUSTOM_UNITS: Array<{
  value: CustomRecurrenceUnit;
  label: string;
}> = [
  { value: "day", label: "Días" },
  { value: "week", label: "Semanas" },
  { value: "month", label: "Meses" },
  { value: "year", label: "Años" },
];

export function ExpenseField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}

export function DayOfMonthPicker({
  value,
  onChange,
  label = "Día de cobro",
}: {
  value: number;
  onChange: (day: number) => void;
  label?: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-white">
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={17} className="text-lime-200" />
          {label}
        </span>
        <span className="rounded-full bg-lime-300/16 px-2.5 py-1 text-xs text-lime-100">
          Día {value}
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

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
}) {
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
        Repetición
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
            {option.label}
          </button>
        ))}
      </div>

      {value.frequency === "custom" ? (
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
            aria-label="Intervalo de repetición"
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
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {value.frequency === "yearly" ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {MONTHS.map((month, index) => {
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
      ) : null}
    </div>
  );
}

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (categoryName: string) => void;
}) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <p className="mb-2 text-sm font-semibold text-white">Categoría</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESET_EXPENSE_CATEGORIES.map((category) => {
          const Icon = categoryIconMap[category.icon] ?? WalletCards;
          const selected = category.name.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onChange(category.name)}
              aria-pressed={selected}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition ${
                selected
                  ? "bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(190,242,100,0.22)]"
                  : `${categoryToneClass(category.tone)} bg-opacity-70`
              }`}
            >
              <Icon size={16} />
              <span className="truncate">{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  function toggleTag(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }

    onChange([...value, tag].slice(0, 8));
  }

  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <p className="mb-2 text-sm font-semibold text-white">Tags</p>
      <div className="flex flex-wrap gap-2">
        {PRESET_EXPENSE_TAGS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={selected}
              className={`h-9 rounded-full px-3 text-sm font-semibold transition ${
                selected
                  ? "bg-cyan-200 text-slate-950 shadow-[0_0_18px_rgba(103,232,249,0.18)]"
                  : "bg-white/[0.055] text-slate-200 ring-1 ring-white/10"
              }`}
            >
              #{tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function parseEuroInput(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatEuroInput(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const categoryIconMap: Record<string, LucideIcon> = {
  Home,
  Sparkles,
  WalletCards,
  Car,
  CreditCard,
  HeartPulse,
  Gamepad2,
  User,
};
