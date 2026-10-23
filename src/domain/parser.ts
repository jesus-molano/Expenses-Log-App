import { parseMoneyInput } from "@/shared/money";
import { toDateOnly } from "./calendar";
import {
  detectCategoryFromText,
  foldText,
  normalizeCapturedExpense,
  type CapturedDraft,
  type CapturedExpenseItem,
} from "./expense-capture";

// Parser sin conexión ni IA. Entiende frases cortas en español o inglés:
// "Netflix 12,99 el 5", "seguro del coche 420 al año en marzo",
// "gimnasio 35 al mes el día 1 y spotify 10,99".

const MONTHS: Array<[number, string[]]> = [
  [1, ["enero", "january", "jan"]],
  [2, ["febrero", "february", "feb"]],
  [3, ["marzo", "march", "mar"]],
  [4, ["abril", "april", "apr"]],
  [5, ["mayo", "may"]],
  [6, ["junio", "june", "jun"]],
  [7, ["julio", "july", "jul"]],
  [8, ["agosto", "august", "aug"]],
  [9, ["septiembre", "setiembre", "september", "sep", "sept"]],
  [10, ["octubre", "october", "oct"]],
  [11, ["noviembre", "november", "nov"]],
  [12, ["diciembre", "december", "dec"]],
];

type FrequencyMatch = Pick<CapturedExpenseItem, "frequency" | "interval" | "unit">;

const FREQUENCIES: Array<[RegExp, FrequencyMatch]> = [
  [/\b(puntual|unico|una vez|solo una vez|one[- ]?time|once)\b/, { frequency: "once", interval: null, unit: null }],
  [/\b(quincenal|cada (dos|2) semanas|biweekly|every (two|2) weeks)\b/, { frequency: "custom", interval: 2, unit: "week" }],
  [/\b(semanal|cada semana|a la semana|weekly|every week|per week|a week)\b/, { frequency: "custom", interval: 1, unit: "week" }],
  [/\b(bimestral|cada (dos|2) meses|bimonthly|every (two|2) months)\b/, { frequency: "custom", interval: 2, unit: "month" }],
  [/\b(trimestral|cada (tres|3) meses|quarterly|every (three|3) months)\b/, { frequency: "quarterly", interval: null, unit: null }],
  [/\b(semestral|cada (seis|6) meses|every (six|6) months)\b/, { frequency: "custom", interval: 6, unit: "month" }],
  [/\b(anual|anualmente|al ano|cada ano|por ano|yearly|annual|annually|per year|a year|every year)\b/, { frequency: "yearly", interval: null, unit: null }],
  [/\b(mensual|mensualmente|al mes|cada mes|por mes|monthly|per month|a month|every month)\b/, { frequency: "monthly", interval: null, unit: null }],
];

const CUSTOM_PATTERN =
  /\b(?:cada|every)\s+(\d{1,2})\s+(dias?|semanas?|meses|mes|anos?|days?|weeks?|months?|years?)\b/;

const DAY_PATTERNS = [
  /\b(?:el\s+)?dia\s+(\d{1,2})\b/,
  /\bon the\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  /\b(\d{1,2})(?:st|nd|rd|th)\b/,
  // "el 5", pero no "el 5,99" ni "el 5 €".
  /\bel\s+(\d{1,2})\b(?![.,]\d|\s*€|\s*(?:eur|euros?)\b)/,
];

const FILLER_WORDS = new Set([
  "de", "del", "el", "la", "los", "las", "al", "a", "en", "y", "cada", "por",
  "euros", "euro", "eur", "unos", "unas", "sobre", "the", "on", "of", "per",
  "every", "and", "for", "about", "around", "mes", "ano", "dia",
]);

function unitFor(token: string): CapturedExpenseItem["unit"] {
  if (/^(dia|day)/.test(token)) return "day";
  if (/^(semana|week)/.test(token)) return "week";
  if (/^(ano|year)/.test(token)) return "year";
  return "month";
}

function detectFrequency(text: string): FrequencyMatch & { match: string | null } {
  const custom = text.match(CUSTOM_PATTERN);
  if (custom) {
    return {
      frequency: "custom",
      interval: Number(custom[1]),
      unit: unitFor(custom[2]),
      match: custom[0],
    };
  }
  for (const [pattern, frequency] of FREQUENCIES) {
    const match = text.match(pattern);
    if (match) return { ...frequency, match: match[0] };
  }
  return { frequency: null, interval: null, unit: null, match: null };
}

function detectMonth(text: string) {
  for (const [month, names] of MONTHS) {
    const name = names.find((candidate) =>
      new RegExp(`\\b(?:en|de|in)\\s+${candidate}\\b|\\b${candidate}\\b`).test(text),
    );
    // "mar" o "may" sueltos son demasiado ambiguos sin "en/in" delante.
    if (name && (name.length > 3 || new RegExp(`\\b(?:en|de|in)\\s+${name}\\b`).test(text))) {
      return { month, name };
    }
  }
  return null;
}

// Importe: primero lo que lleva € o "euros", luego un número con decimales y,
// si no, el último número que no sea el día.
function detectAmount(text: string) {
  const candidates = [
    /(\d[\d.,]*)\s*(?:€|eur\b|euros?\b)/,
    /€\s*(\d[\d.,]*)/,
    /\b(\d{1,3}(?:[.,]\d{3})*[.,]\d{1,2}|\d+[.,]\d{1,2})\b/,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    const amount = match ? parseMoneyInput(match[1].replace(/[.,]$/, "")) : null;
    if (match && amount !== null) return { amount, match: match[0] };
  }
  const numbers = Array.from(text.matchAll(/\b\d[\d.,]*\b/g));
  const last = numbers.at(-1);
  const amount = last ? parseMoneyInput(last[0]) : null;
  return last && amount !== null ? { amount, match: last[0] } : { amount: null, match: null };
}

function detectDay(text: string) {
  for (const pattern of DAY_PATTERNS) {
    const match = text.match(pattern);
    const day = match ? Number(match[1]) : NaN;
    if (match && day >= 1 && day <= 31) return { day, match: match[0] };
  }
  return { day: null, match: null };
}

function cleanName(original: string, folded: string, removed: Array<string | null>) {
  let remaining = folded;
  for (const part of removed) {
    if (part) remaining = remaining.replace(part, " ");
  }
  // Se recuperan las palabras originales (con tildes y mayúsculas) que siguen
  // presentes tras quitar importe, día, frecuencia y mes.
  const kept = new Set(
    remaining
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word && !FILLER_WORDS.has(word) && !/^\d+$/.test(word)),
  );
  const words = original
    .split(/\s+/)
    .map((word) => word.replace(/[.,;:€]+$/u, ""))
    .filter((word) => kept.has(foldText(word)));
  const name = words.slice(0, 5).join(" ");
  return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : null;
}

function parseSegment(segment: string): CapturedExpenseItem {
  const folded = foldText(segment);
  const day = detectDay(folded);
  const withoutDay = day.match ? folded.replace(day.match, " ") : folded;
  const frequency = detectFrequency(withoutDay);
  // "cada 2 semanas" no es un importe.
  const withoutFrequency = frequency.match
    ? withoutDay.replace(frequency.match, " ")
    : withoutDay;
  const month = detectMonth(withoutFrequency);
  const amount = detectAmount(withoutFrequency);
  const name = cleanName(segment, folded, [
    day.match,
    frequency.match,
    month ? month.name : null,
    amount.match,
  ]);

  return {
    name,
    amount: amount.amount,
    categoryName: detectCategoryFromText(segment),
    frequency: frequency.frequency,
    interval: frequency.interval,
    unit: frequency.unit,
    dueDay: day.day,
    annualMonth: month?.month ?? null,
    startDate: null,
    description: segment.trim(),
  };
}

// Varios gastos separados por líneas, ";" o " y "/" and " cuando cada parte
// tiene un número; si no, es un solo gasto ("luz y agua 60").
function splitExpenses(text: string) {
  const parts = text
    .split(/\n|;|\s+y\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const withNumbers = parts.filter((part) => /\d/.test(part));
  return withNumbers.length >= 2 && withNumbers.length === parts.length
    ? parts
    : [text.trim()];
}

export function parseExpenseTextLocally(
  input: string,
  {
    today = toDateOnly(new Date()),
    categories = [],
  }: { today?: string; categories?: string[] } = {},
): CapturedDraft[] {
  const text = input.trim();
  if (!text) return [];

  return splitExpenses(text)
    .slice(0, 10)
    .map((segment) => normalizeCapturedExpense(parseSegment(segment), { today, categories }));
}
