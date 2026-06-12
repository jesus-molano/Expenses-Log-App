import {
  addDays,
  format,
  isSaturday,
  isSunday,
  parseISO,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { AppLanguage } from "./types";

export const APP_TIME_ZONE = "Atlantic/Canary";
export const DEFAULT_CURRENCY = "EUR";

export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
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

export function formatShortDate(date: string): string {
  return format(parseISO(date), "d MMM", { locale: es });
}

export function daysBetween(from: string, to: string): number {
  const start = parseISO(from);
  const end = parseISO(to);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}
