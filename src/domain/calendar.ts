import {
  addDays,
  format,
  isSaturday,
  isSunday,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

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

export function estimateChargeDate(dueDate: string): {
  date: string;
  label: string;
} {
  const date = parseISO(dueDate);

  if (isSaturday(date)) {
    const estimated = addDays(date, 2);
    return {
      date: toDateOnly(estimated),
      label: `estimado ${format(estimated, "EEEE d", { locale: es })}`,
    };
  }

  if (isSunday(date)) {
    const estimated = addDays(date, 1);
    return {
      date: toDateOnly(estimated),
      label: `estimado ${format(estimated, "EEEE d", { locale: es })}`,
    };
  }

  return {
    date: dueDate,
    label: `cobro ${format(date, "EEEE d", { locale: es })}`,
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
