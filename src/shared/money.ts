import type { AppLanguage } from "@/domain/types";

// Importes en campos de texto editables. Se formatean sin separador de miles
// para que lo que el usuario ve se pueda volver a leer sin ambigüedad.
export function formatMoneyInput(value: number, language: AppLanguage = "es") {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

// Lee importes en formato español o inglés: "1.234,56", "1,234.56", "64,75",
// "64.75", "2.200" (miles) o "12 €". Devuelve null si no es un importe válido.
export function parseMoneyInput(value: string): number | null {
  const clean = value.trim().replace(/[\s €]/g, "");
  if (!clean || !/^\d[\d.,]*$/.test(clean)) return null;

  const normalized = normalizeSeparators(clean);
  if (normalized === null || !/^\d+(\.\d+)?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

export function isValidPositiveMoneyInput(value: string) {
  const amount = parseMoneyInput(value);
  return amount !== null && amount > 0;
}

function normalizeSeparators(value: string): string | null {
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  // Con los dos separadores, el último es el decimal y el otro agrupa miles.
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const [integer, fraction, ...rest] = value.split(decimal);
    if (rest.length || !isGroupedInteger(integer, grouping)) return null;
    return `${integer.split(grouping).join("")}.${fraction}`;
  }

  const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
  if (!separator) return value;

  const parts = value.split(separator);
  // Varias apariciones o un único grupo de 3 cifras tras 1-3 cifras: miles.
  if (parts.length > 2) {
    return isGroupedInteger(value, separator) ? parts.join("") : null;
  }
  if (parts[1].length === 3 && isGroupedInteger(value, separator)) {
    return parts.join("");
  }
  return `${parts[0]}.${parts[1]}`;
}

function isGroupedInteger(value: string, separator: string) {
  if (!value.includes(separator)) return /^\d+$/.test(value);
  const [head, ...groups] = value.split(separator);
  return (
    /^[1-9]\d{0,2}$/.test(head) &&
    groups.every((group) => /^\d{3}$/.test(group))
  );
}
