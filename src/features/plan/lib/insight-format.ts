import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

export function formatPercent(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDaysUntil(days: number, language: AppLanguage) {
  if (days <= 0) return t("insights.largeBills.today", language);
  if (days === 1) return t("insights.largeBills.tomorrow", language);
  return t("insights.largeBills.inDays", language).replace("{days}", String(days));
}

// "+12,50 €" / "−8,00 €": el signo siempre visible para que la dirección no
// dependa del color.
export function formatSignedCurrency(value: number, format: (amount: number) => string) {
  if (value > 0) return `+${format(value)}`;
  if (value < 0) return `−${format(Math.abs(value))}`;
  return `±${format(0)}`;
}
