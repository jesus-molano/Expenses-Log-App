import { parseMoneyInput } from "@/shared/money";
import { toDateOnly } from "./calendar";
import {
  detectCategoryFromText,
  normalizeCapturedExpense,
  type CapturedDraft,
  type CapturedExpenseItem,
} from "./expense-capture";
import { foldText } from "./text";

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
  // "15/03" o "15/03/2027": día y mes.
  /\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/,
  /\b(?:el\s+)?dia\s+(\d{1,2})\b/,
  /\bon the\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  /\b(\d{1,2})(?:st|nd|rd|th)\b/,
  // "el 5", pero no "el 5,99" ni "el 5 €".
  /\bel\s+(\d{1,2})\b(?![.,]\d|\s*€|\s*(?:eur|euros?)\b)/,
];

const FILLER_WORDS = new Set([
  "de", "del", "el", "la", "los", "las", "al", "a", "en", "y", "cada", "por",
  "euros", "euro", "eur", "unos", "unas", "sobre", "the", "on", "of", "per",
  "every", "and", "for", "about", "around", "mes", "ano", "dia", "in", "at",
]);

// Números que no son importes: horas, fechas y años.
const NOT_AMOUNT_PATTERNS = [
  /\b(?:a las|at)\s+\d{1,2}(?:[:.]\d{2})?(?:\s*(?:h|am|pm)\b)?/g,
  /\b\d{1,2}:\d{2}\b/g,
  /\b\d{1,2}\s*(?:h|am|pm)\b/g,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
];
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/g;

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
// si no, el último número que no sea el día, una hora, una fecha o un año.
// En ese último caso, si había más de un candidato, se marca para revisar.
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
  let plain = NOT_AMOUNT_PATTERNS.reduce((rest, pattern) => rest.replace(pattern, " "), text);
  const withoutYears = plain.replace(YEAR_PATTERN, " ");
  if (/\d/.test(withoutYears)) plain = withoutYears;
  const numbers = Array.from(plain.matchAll(/\b\d[\d.,]*\b/g));
  const last = numbers.at(-1);
  const amount = last ? parseMoneyInput(last[0]) : null;
  return last && amount !== null
    ? { amount, match: last[0], guessed: numbers.length > 1 }
    : { amount: null, match: null };
}

function detectDay(text: string) {
  for (const pattern of DAY_PATTERNS) {
    const match = text.match(pattern);
    const day = match ? Number(match[1]) : NaN;
    const month = match?.[2] ? Number(match[2]) : null;
    if (match && day >= 1 && day <= 31 && (month === null || (month >= 1 && month <= 12))) {
      return { day, month, match: match[0] };
    }
  }
  return { day: null, month: null, match: null };
}

function wordCore(word: string) {
  return foldText(word).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function cleanName(original: string, folded: string, removed: Array<string | null>) {
  let remaining = folded;
  for (const part of removed) {
    if (part) remaining = remaining.replace(part, " ");
  }
  // Se recuperan las palabras originales (con tildes, mayúsculas y símbolos
  // como "Disney+") que siguen presentes tras quitar importe, día,
  // frecuencia y mes. Los conectores ("de", "y") se conservan solo entre dos
  // palabras del nombre: "Seguro del coche", "Luz y gas".
  const kept = new Set(
    remaining
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word && !FILLER_WORDS.has(word) && !/^\d+$/.test(word)),
  );
  const words = original
    .split(/\s+/)
    .map((word) => word.replace(/^[("'¿¡]+|[.,;:€)"'!?]+$/gu, ""))
    .filter(Boolean)
    .map((word) => {
      const core = wordCore(word);
      if (core.length && core.every((token) => FILLER_WORDS.has(token))) {
        return { word, kind: "filler" as const };
      }
      return { word, kind: core.some((token) => kept.has(token)) ? ("name" as const) : ("other" as const) };
    });

  const nameWords: string[] = [];
  let connectors: string[] = [];
  for (const { word, kind } of words) {
    if (kind === "name") {
      nameWords.push(...connectors, word);
      connectors = [];
    } else if (kind === "filler" && nameWords.length) {
      connectors.push(word);
    } else {
      connectors = [];
    }
  }
  const name = nameWords.slice(0, 6).join(" ");
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
  const annualMonth = month?.month ?? day.month;
  const name = cleanName(segment, folded, [
    day.match,
    frequency.match,
    month ? month.name : null,
    amount.match,
  ]);

  return {
    name,
    amount: amount.amount,
    amountGuessed: amount.guessed ?? false,
    categoryName: detectCategoryFromText(segment),
    frequency: frequency.frequency,
    interval: frequency.interval,
    unit: frequency.unit,
    dueDay: day.day,
    annualMonth,
    startDate: null,
    description: segment.trim(),
  };
}

// Varios gastos separados por líneas, ";" o " y "/" and ". Una parte sin
// número pertenece al nombre de la siguiente ("luz y gas 80 y netflix 12,99"
// son dos gastos: "luz y gas" y "netflix"); al final, es un gasto sin importe.
function splitExpenses(text: string) {
  const pieces = text.split(/(\n|;|\s+(?:y|and)\s+)/i);
  const segments: string[] = [];
  let pending = "";
  for (let index = 0; index < pieces.length; index += 2) {
    const part = pending + pieces[index];
    const separator = pieces[index + 1] ?? "";
    if (/\d/.test(pieces[index]) || index === pieces.length - 1) {
      if (part.trim()) segments.push(part.trim());
      pending = "";
    } else {
      pending = part + (/^\s+(?:y|and)\s+$/i.test(separator) ? separator : " ");
    }
  }
  return segments.length ? segments : [text.trim()];
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
