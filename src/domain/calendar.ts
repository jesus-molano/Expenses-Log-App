import {
  addDays,
  differenceInCalendarDays,
  format,
  isSaturday,
  isSunday,
  parseISO,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { AppLanguage } from "./types";

export const DEFAULT_CURRENCY = "EUR";

export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Admite fechas con hora ISO ("2026-11-15T00:00:00Z"): cuenta el día tal cual
// está escrito, que es el que ve el usuario.
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function isValidDateOnly(value: unknown): value is string {
  return normalizeDateOnly(value) === value;
}

// Fecha YYYY-MM-DD válida. Un día que no existe en ese mes (31 de noviembre)
// se ajusta al último día; cualquier otra cosa devuelve undefined.
export function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return undefined;

  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const lastDay = new Date(year, month, 0).getDate();
  return toDateOnly(new Date(year, month - 1, Math.min(day, lastDay)));
}

export function buildDateWithDay(baseDate: Date, dueDay: number): Date {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(dueDay, 1), lastDay));
}

export function estimateChargeDate(dueDate: string, language: AppLanguage = "es"): {
  date: string;
  label: string;
} {
  const date = parseISO(dueDate);
  const locale = language === "en" ? enUS : es;
  const estimatedPrefix = language === "en" ? "estimated" : "estimado";
  const chargePrefix = language === "en" ? "charges" : "cobro";

  if (isSaturday(date)) {
    const estimated = addDays(date, 2);
    return {
      date: toDateOnly(estimated),
      label: `${estimatedPrefix} ${format(estimated, "EEEE d", { locale })}`,
    };
  }

  if (isSunday(date)) {
    const estimated = addDays(date, 1);
    return {
      date: toDateOnly(estimated),
      label: `${estimatedPrefix} ${format(estimated, "EEEE d", { locale })}`,
    };
  }

  return {
    date: dueDate,
    label: `${chargePrefix} ${format(date, "EEEE d", { locale })}`,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
  }).format(amount);
}

export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}
