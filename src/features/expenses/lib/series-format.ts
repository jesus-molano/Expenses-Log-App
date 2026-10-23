import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { PriceHistoryEntry } from "@/domain/amount-history";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

function localeOf(language: AppLanguage) {
  return language === "en" ? enUS : es;
}

// "5 nov" (o "5 nov 2027" si no es el año de hoy).
export function formatChargeDate(date: string, language: AppLanguage, today: string) {
  const pattern = date.slice(0, 4) === today.slice(0, 4) ? "d MMM" : "d MMM yyyy";
  return format(parseISO(date), pattern, { locale: localeOf(language) });
}

// "nov 2026"
export function formatPriceMonth(date: string, language: AppLanguage) {
  return format(parseISO(date), "LLL yyyy", { locale: localeOf(language) });
}

// Tramo del historial de precio: el más reciente "Desde oct 2026"; el resto,
// "jun – sep 2026" o un solo mes.
export function priceRangeLabel(
  entry: PriceHistoryEntry,
  language: AppLanguage,
  latest: boolean,
) {
  const from = formatPriceMonth(entry.from, language);
  if (latest) return t("bills.priceSince", language).replace("{month}", from);
  const to = formatPriceMonth(entry.to, language);
  if (from === to) return from;
  const fromLabel =
    entry.from.slice(0, 4) === entry.to.slice(0, 4)
      ? format(parseISO(entry.from), "LLL", { locale: localeOf(language) })
      : from;
  return `${fromLabel} – ${to}`;
}
