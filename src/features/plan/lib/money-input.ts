import type { AppLanguage } from "@/domain/types";

export function formatMoneyInput(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseMoneyInput(value: string) {
  const clean = value.trim().replace(/\s/g, "");
  const commaIndex = clean.lastIndexOf(",");
  const dotIndex = clean.lastIndexOf(".");
  const decimalSeparator =
    commaIndex > dotIndex ? "," : dotIndex > commaIndex ? "." : null;
  const normalized = decimalSeparator
    ? clean
        .replace(new RegExp(`\\${decimalSeparator === "," ? "." : ","}`, "g"), "")
        .replace(decimalSeparator, ".")
    : clean;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}
