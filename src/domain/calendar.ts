import {
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import { nextBankBusinessDay } from "./holidays";
import type { AppLanguage } from "./types";

// Zona por defecto de los avisos push (ajustable en Ajustes > Recordatorios).
export const APP_TIME_ZONE = "Atlantic/Canary";
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

// Día en que el banco carga el recibo: el propio vencimiento o, si cae en fin
// de semana o festivo bancario (`holidays.ts`), el siguiente día hábil.
export function estimateChargeDate(dueDate: string, language: AppLanguage = "es"): {
  date: string;
  label: string;
} {
  const locale = language === "en" ? enUS : es;
  const chargeDate = nextBankBusinessDay(dueDate);

  if (chargeDate !== dueDate) {
    const estimatedPrefix = language === "en" ? "estimated" : "estimado";
    return {
      date: chargeDate,
      label: `${estimatedPrefix} ${format(parseISO(chargeDate), "EEEE d", { locale })}`,
    };
  }

  const chargePrefix = language === "en" ? "charges" : "cobro";
  return {
    date: dueDate,
    label: `${chargePrefix} ${format(parseISO(dueDate), "EEEE d", { locale })}`,
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

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Fecha (YYYY-MM-DD) y hora (0-23) de un instante en una zona horaria, sin
// depender de la zona del proceso: el servidor corre en UTC y el usuario no.
export function zonedDateParts(
  instant: Date,
  timeZone: string,
): { date: string; hour: number } {
  const zone = isValidTimeZone(timeZone) ? timeZone : APP_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    // Algunos motores devuelven "24" a medianoche aun con h23.
    hour: Number(part("hour")) % 24,
  };
}
