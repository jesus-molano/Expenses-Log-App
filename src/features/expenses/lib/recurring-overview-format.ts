import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { AppLanguage } from "@/domain/types";

export function formatRecurringDate(date: string, language: AppLanguage) {
  const locale = language === "en" ? enUS : es;
  return format(parseISO(date), "d MMM yyyy", { locale });
}
