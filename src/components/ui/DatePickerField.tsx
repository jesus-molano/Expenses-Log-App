"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toDateOnly } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { cn } from "@/shared/ui";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

type DatePickerFieldProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  label: string;
  language?: AppLanguage;
  min?: string;
  max?: string;
  allowClear?: boolean;
  placeholder?: string;
  className?: string;
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDisabled(date: Date, min?: string, max?: string): boolean {
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  return Boolean(
    (minDate && isBefore(date, minDate)) ||
      (maxDate && isAfter(date, maxDate)),
  );
}

function yearOptions(visibleMonth: Date, min?: string, max?: string): number[] {
  const currentYear = new Date().getFullYear();
  const minYear = parseDate(min)?.getFullYear() ?? currentYear - 5;
  const maxYear = parseDate(max)?.getFullYear() ?? currentYear + 8;
  const visibleYear = visibleMonth.getFullYear();
  const startYear = Math.min(minYear, visibleYear);
  const endYear = Math.max(maxYear, visibleYear);

  return Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );
}

export function DatePickerField({
  value,
  onChange,
  label,
  language = "es",
  min,
  max,
  allowClear = false,
  placeholder,
  className,
}: DatePickerFieldProps) {
  const locale = language === "en" ? enUS : es;
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const fallbackMonth = useMemo(() => parseDate(min) ?? new Date(), [min]);
  const [open, setOpen] = useState(false);
  const [activeSelector, setActiveSelector] = useState<"month" | "year" | null>(
    null,
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ?? fallbackMonth,
  );

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
    });
  }, [visibleMonth]);

  const buttonText = selectedDate
    ? format(selectedDate, "d MMM yyyy", { locale })
    : (placeholder ?? label);
  const weekdays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(new Date(2026, 5, 8), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(2026, 5, 8), { weekStartsOn: 1 }),
      }).map((day) => format(day, "EEEEE", { locale })),
    [locale],
  );
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        format(new Date(2026, index, 1), "MMM", { locale }),
      ),
    [locale],
  );
  const years = useMemo(
    () => yearOptions(visibleMonth, min, max),
    [visibleMonth, min, max],
  );

  function selectDate(date: Date) {
    if (isDisabled(date, min, max)) return;
    onChange(toDateOnly(date));
    setOpen(false);
  }

  function openPicker() {
    setVisibleMonth(selectedDate ?? fallbackMonth);
    setActiveSelector(null);
    setOpen(true);
  }

  function setVisibleMonthPart(monthIndex: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setActiveSelector(null);
  }

  function setVisibleYear(year: number) {
    setVisibleMonth((current) => new Date(year, current.getMonth(), 1));
    setActiveSelector(null);
  }

  const pickerDialog = open ? (
    <div
      className="app-sheet-backdrop app-datepicker-backdrop z-[80] animate-[fade-in_180ms_ease-out]"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
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
          <IconButton
            type="button"
            onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
            aria-label={language === "en" ? "Previous month" : "Mes anterior"}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <div className="relative z-10 grid min-w-0 flex-1 grid-cols-[minmax(0,8.5rem)_5.75rem] justify-center gap-2">
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() =>
                  setActiveSelector((current) =>
                    current === "month" ? null : "month",
                  )
                }
                aria-expanded={activeSelector === "month"}
                className="input-control flex h-10 min-w-0 items-center justify-between gap-2 pr-3 text-left"
                aria-label={language === "en" ? "Month" : "Mes"}
              >
                <span className="truncate">
                  {months[visibleMonth.getMonth()]}
                </span>
                <ChevronDown
                  size={17}
                  className="shrink-0 text-[var(--app-accent)]"
                />
              </button>
              {activeSelector === "month" ? (
                <div
                  className="app-select-menu-panel absolute left-1/2 top-[calc(100%+0.5rem)] z-20 grid w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-1 rounded-[var(--app-radius-lg)] p-2"
                  style={{ backgroundColor: "var(--app-surface-strong)" }}
                >
                  {months.map((month, index) => {
                    const selected = visibleMonth.getMonth() === index;
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => setVisibleMonthPart(index)}
                        aria-pressed={selected}
                        className="app-select-menu-option h-10 rounded-[var(--app-radius-sm)] px-2 text-sm font-semibold"
                        data-selected={selected ? "true" : "false"}
                      >
                        {month}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() =>
                  setActiveSelector((current) =>
                    current === "year" ? null : "year",
                  )
                }
                aria-expanded={activeSelector === "year"}
                className="input-control flex h-10 min-w-0 items-center justify-between gap-2 pr-3 text-left"
                aria-label={language === "en" ? "Year" : "Año"}
              >
                <span className="truncate">{visibleMonth.getFullYear()}</span>
                <ChevronDown
                  size={17}
                  className="shrink-0 text-[var(--app-accent)]"
                />
              </button>
              {activeSelector === "year" ? (
                <div
                  className="app-select-menu-panel absolute left-1/2 top-[calc(100%+0.5rem)] z-20 grid w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-1 rounded-[var(--app-radius-lg)] p-2"
                  style={{ backgroundColor: "var(--app-surface-strong)" }}
                >
                  {years.map((year) => {
                    const selected = visibleMonth.getFullYear() === year;
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => setVisibleYear(year)}
                        aria-pressed={selected}
                        className="app-select-menu-option h-10 rounded-[var(--app-radius-sm)] px-2 text-sm font-semibold"
                        data-selected={selected ? "true" : "false"}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <IconButton
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            aria-label={language === "en" ? "Next month" : "Mes siguiente"}
          >
            <ChevronRight size={18} />
          </IconButton>
        </header>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-[var(--app-text-subtle)]">
          {weekdays.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = day.getMonth() === visibleMonth.getMonth();
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;
            const disabled = isDisabled(day, min, max);

            return (
              <button
                key={toDateOnly(day)}
                type="button"
                onClick={() => selectDate(day)}
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  "app-control grid aspect-square min-h-10 place-items-center rounded-[var(--app-radius-md)] text-sm font-semibold disabled:pointer-events-none disabled:opacity-30",
                  selected
                    ? "app-chip-selected"
                    : "text-[var(--app-text)]",
                  !inMonth && "text-[var(--app-text-subtle)]",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <footer className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => setOpen(false)}
            variant="secondary"
          >
            {language === "en" ? "Close" : "Cerrar"}
          </Button>
          {allowClear ? (
            <Button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              variant="secondary"
              leadingIcon={<X size={16} />}
            >
              {language === "en" ? "Clear" : "Limpiar"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => selectDate(new Date())}
              variant="primary"
            >
              {language === "en" ? "Today" : "Hoy"}
            </Button>
          )}
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "input-control flex w-full items-center justify-between gap-3 text-left",
          className,
        )}
        aria-label={label}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selectedDate ? "text-[var(--app-text)]" : "text-[var(--app-text-subtle)]",
          )}
        >
          {buttonText}
        </span>
        <CalendarDays size={18} className="shrink-0 text-[var(--app-accent)]" />
      </button>

      {typeof document !== "undefined" && pickerDialog
        ? createPortal(pickerDialog, document.body)
        : null}
    </>
  );
}
