import { addDays, format, isWeekend, parseISO } from "date-fns";

// Días sin cargos bancarios en España: un recibo domiciliado que vence en uno
// de ellos se cobra el siguiente día hábil.
//
// - Festivos nacionales de fecha fija (los nueve comunes a toda España).
// - Viernes Santo (nacional) y Jueves Santo (festivo en casi todas las
//   comunidades, Canarias incluida).
// - Lunes de Pascua y 26 de diciembre: TARGET2, el sistema que liquida los
//   adeudos SEPA, cierra esos días aunque no sean festivos en todo el país.
//
// No se modelan los festivos autonómicos ni locales, ni los traslados al lunes
// de un festivo que cae en domingo (cambian cada año y por comunidad).

export type BankHolidayKind = "national" | "easter" | "target";

export type BankHoliday = {
  date: string;
  key: BankHolidayKey;
  kind: BankHolidayKind;
};

export type BankHolidayKey =
  | "newYear"
  | "epiphany"
  | "holyThursday"
  | "goodFriday"
  | "easterMonday"
  | "labourDay"
  | "assumption"
  | "nationalDay"
  | "allSaints"
  | "constitution"
  | "immaculateConception"
  | "christmas"
  | "boxingDay";

const FIXED_HOLIDAYS: Array<{
  month: number;
  day: number;
  key: BankHolidayKey;
  kind: BankHolidayKind;
}> = [
  { month: 1, day: 1, key: "newYear", kind: "national" },
  { month: 1, day: 6, key: "epiphany", kind: "national" },
  { month: 5, day: 1, key: "labourDay", kind: "national" },
  { month: 8, day: 15, key: "assumption", kind: "national" },
  { month: 10, day: 12, key: "nationalDay", kind: "national" },
  { month: 11, day: 1, key: "allSaints", kind: "national" },
  { month: 12, day: 6, key: "constitution", kind: "national" },
  { month: 12, day: 8, key: "immaculateConception", kind: "national" },
  { month: 12, day: 25, key: "christmas", kind: "national" },
  { month: 12, day: 26, key: "boxingDay", kind: "target" },
];

// Desplazamiento en días respecto al domingo de Pascua.
const EASTER_HOLIDAYS: Array<{
  offset: number;
  key: BankHolidayKey;
  kind: BankHolidayKind;
}> = [
  { offset: -3, key: "holyThursday", kind: "easter" },
  { offset: -2, key: "goodFriday", kind: "national" },
  { offset: 1, key: "easterMonday", kind: "target" },
];

// Domingo de Pascua del calendario gregoriano (algoritmo anónimo de
// Meeus/Jones/Butcher). Devuelve YYYY-MM-DD.
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidaysByYear = new Map<number, BankHoliday[]>();

export function spanishBankHolidays(year: number): BankHoliday[] {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;

  const easter = parseISO(easterSunday(year));
  const holidays = [
    ...FIXED_HOLIDAYS.map(({ month, day, key, kind }) => ({
      date: `${year}-${pad(month)}-${pad(day)}`,
      key,
      kind,
    })),
    ...EASTER_HOLIDAYS.map(({ offset, key, kind }) => ({
      date: format(addDays(easter, offset), "yyyy-MM-dd"),
      key,
      kind,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  holidaysByYear.set(year, holidays);
  return holidays;
}

export function bankHolidayOn(date: string): BankHoliday | null {
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return spanishBankHolidays(year).find((holiday) => holiday.date === date) ?? null;
}

export function isBankBusinessDay(date: string): boolean {
  return !isWeekend(parseISO(date)) && !bankHolidayOn(date);
}

// Primer día hábil en o después de `date`. Como mucho hay cinco días seguidos
// sin cargos (Jueves Santo a Lunes de Pascua); el tope solo evita un bucle si
// llegara una fecha ilegible.
export function nextBankBusinessDay(date: string): string {
  let current = date;
  for (let guard = 0; guard < 10 && !isBankBusinessDay(current); guard += 1) {
    current = format(addDays(parseISO(current), 1), "yyyy-MM-dd");
  }
  return current;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
