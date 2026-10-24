import { parseMoneyInput } from "@/shared/money";
import { normalizeDateOnly, toDateOnly } from "./calendar";
import {
  normalizeCaptureCommand,
  type CaptureCommand,
  type CaptureIntent,
} from "./capture-commands";
import {
  detectCategoryFromText,
  normalizeCapturedExpense,
  type CapturedDraft,
  type CapturedExpenseItem,
} from "./expense-capture";
import { foldText } from "./text";

// Parser sin conexión ni IA. Entiende frases cortas en español o inglés:
// "Netflix 12,99 el 5", "seguro del coche 420 al año en marzo",
// "gimnasio 35 al mes el día 1 y spotify 10,99". También órdenes sobre gastos
// que ya existen: "marca la luz pagada 71,20", "salta el gimnasio este mes",
// "mueve Netflix al 10".

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

function cleanName(
  original: string,
  folded: string,
  removed: Array<string | null>,
  fillers: Set<string> = FILLER_WORDS,
) {
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
      .filter((word) => word && !fillers.has(word) && !/^\d+$/.test(word)),
  );
  const words = original
    .split(/\s+/)
    .map((word) => word.replace(/^[("'¿¡]+|[.,;:€)"'!?]+$/gu, ""))
    .filter(Boolean)
    .map((word) => {
      const core = wordCore(word);
      if (core.length && core.every((token) => fillers.has(token))) {
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
// Una orden ("salta el gimnasio") va sola aunque no tenga número.
function splitExpenses(text: string) {
  const pieces = text.split(/(\n|;|\s+(?:y|and)\s+)/i);
  const segments: string[] = [];
  let pending = "";
  for (let index = 0; index < pieces.length; index += 2) {
    const part = pending + pieces[index];
    const separator = pieces[index + 1] ?? "";
    if (
      /\d/.test(pieces[index]) ||
      detectCommandIntent(foldText(pieces[index])) ||
      index === pieces.length - 1
    ) {
      if (part.trim()) segments.push(part.trim());
      pending = "";
    } else {
      pending = part + (/^\s+(?:y|and)\s+$/i.test(separator) ? separator : " ");
    }
  }
  return segments.length ? segments : [text.trim()];
}

type CommandIntent = Exclude<CaptureIntent, "create">;

// Órdenes sobre un gasto existente. Los verbos cuentan al principio de la
// frase, para no confundir un alta como "Paga extra 1000 en junio".
const INTENT_PATTERNS: Array<[CommandIntent, RegExp]> = [
  [
    "pay",
    /^(?:marca|marcar|marcame|marque|marcalo|marcala|mark)\b|\bpagad[oa]s?\b|\b(?:he|hemos|ya)\s+pagado\b|\bya\s+pague\b|^pague\b|\bpaid\b/,
  ],
  [
    "skip",
    /^(?:salta|saltar|saltate|saltame|saltalo|saltala|omite|omitir|omitelo|omitela|quita|quitar|quitalo|quitala|skip)\b|\beste mes no\b/,
  ],
  [
    "move",
    /^(?:mueve|mover|muevelo|muevela|aplaza|aplazar|retrasa|retrasar|adelanta|adelantar|move|postpone|reschedule)\b/,
  ],
];

// "Cambia" o "pasa" solo son mover si dicen a qué día: "cambia la luz al 10".
const SOFT_MOVE_PATTERN = /^(?:cambia|cambiar|pasa|pasar|change)\b/;

const MOVE_TARGET_PATTERNS = [
  /\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/,
  /\b(?:al|a|para el|hasta el)\s+(?:dia\s+)?(\d{1,2})\b(?![.,]\d)/,
  /\b(?:el\s+)?dia\s+(\d{1,2})\b/,
  /\bto\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/,
  /\bel\s+(\d{1,2})\b(?![.,]\d|\s*€)/,
];

const NEXT_MONTH_PATTERN = /\b(?:el\s+)?mes\s+que\s+viene\b|\b(?:el\s+)?proximo\s+mes\b|\bnext\s+month\b/;
const THIS_MONTH_PATTERN = /\b(?:este|esta)\s+mes\b|\bthis\s+month\b/;

// Palabras de la orden que no forman parte del nombre del gasto.
const COMMAND_FILLERS = new Set([
  ...FILLER_WORDS,
  "marca", "marcar", "marcame", "marque", "marcalo", "marcala", "mark",
  "pagado", "pagada", "pagados", "pagadas", "pague", "paid", "he", "hemos", "ya",
  "salta", "saltar", "saltate", "saltame", "saltalo", "saltala", "omite", "omitir",
  "omitelo", "omitela", "quita", "quitar", "quitalo", "quitala", "skip",
  "mueve", "mover", "muevelo", "muevela", "aplaza", "aplazar", "retrasa", "retrasar",
  "adelanta", "adelantar", "move", "postpone", "reschedule", "cambia", "cambiar",
  "pasa", "pasar", "change", "como", "as", "este", "esta", "mes", "month", "this",
  "next", "proximo", "que", "viene", "no", "to", "it", "para", "hasta", "i", "we", "have",
]);

function detectMoveTarget(folded: string, today: string) {
  for (const pattern of MOVE_TARGET_PATTERNS) {
    const match = folded.match(pattern);
    if (!match) continue;
    const day = Number(match[1]);
    if (day < 1 || day > 31) continue;
    if (!match[2]) return { day, date: null, match: match[0] };
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;
    // "15/11": el próximo 15 de noviembre desde el mes en curso.
    const year = Number(today.slice(0, 4));
    const mm = String(month).padStart(2, "0");
    const thisYear = `${year}-${mm}`;
    const monthId = thisYear >= today.slice(0, 7) ? thisYear : `${year + 1}-${mm}`;
    const date = normalizeDateOnly(`${monthId}-${String(day).padStart(2, "0")}`) ?? null;
    return { day: null, date, match: match[0] };
  }
  return { day: null, date: null, match: null };
}

export function detectCommandIntent(folded: string): CommandIntent | null {
  const text = folded.trim();
  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (pattern.test(text)) return intent;
  }
  if (SOFT_MOVE_PATTERN.test(text) && detectMoveTarget(text, "2000-01-01").match) return "move";
  return null;
}

// Una parte sin verbo tras una orden sigue esa orden ("salta el gimnasio y
// netflix este mes"), salvo que tenga pinta de alta: frecuencia o día.
function looksLikeNewExpense(folded: string) {
  return (
    detectFrequency(folded).frequency !== null ||
    DAY_PATTERNS.some((pattern) => pattern.test(folded))
  );
}

function parseCommandSegment(segment: string, intent: CommandIntent, today: string) {
  const folded = foldText(segment);
  const target = intent === "move" ? detectMoveTarget(folded, today) : { day: null, date: null, match: null };
  let rest = target.match ? folded.replace(target.match, " ") : folded;
  const relative = rest.match(NEXT_MONTH_PATTERN) ?? rest.match(THIS_MONTH_PATTERN);
  if (relative) rest = rest.replace(relative[0], " ");
  const nextMonth = Boolean(relative && NEXT_MONTH_PATTERN.test(relative[0]));
  const month = nextMonth ? null : detectMonth(rest);
  const amount = intent === "pay" ? detectAmount(month ? rest.replace(month.name, " ") : rest) : null;
  const name = cleanName(
    segment,
    folded,
    [target.match, relative?.[0] ?? null, month ? month.name : null, amount?.match ?? null],
    COMMAND_FILLERS,
  );

  return normalizeCaptureCommand({
    intent,
    name,
    amount: amount?.amount ?? null,
    dueDay: target.day,
    startDate: target.date,
    annualMonth: nextMonth ? (Number(today.slice(5, 7)) % 12) + 1 : month?.month ?? null,
  });
}

export type LocalCaptureResult = {
  drafts: CapturedDraft[];
  commands: CaptureCommand[];
};

// Altas y órdenes de un mismo texto, en el orden en que se dicen.
export function parseCaptureTextLocally(
  input: string,
  {
    today = toDateOnly(new Date()),
    categories = [],
  }: { today?: string; categories?: string[] } = {},
): LocalCaptureResult {
  const text = input.trim();
  const result: LocalCaptureResult = { drafts: [], commands: [] };
  if (!text) return result;

  let previousIntent: CommandIntent | null = null;
  for (const segment of splitExpenses(text).slice(0, 10)) {
    const folded = foldText(segment);
    const intent: CommandIntent | null =
      detectCommandIntent(folded) ??
      (previousIntent && !looksLikeNewExpense(folded) ? previousIntent : null);
    const command: CaptureCommand | null = intent
      ? parseCommandSegment(segment, intent, today)
      : null;
    if (command) {
      result.commands.push(command);
      previousIntent = command.intent;
      continue;
    }
    previousIntent = null;
    result.drafts.push(normalizeCapturedExpense(parseSegment(segment), { today, categories }));
  }
  return result;
}

// Solo las altas (las órdenes se descartan).
export function parseExpenseTextLocally(
  input: string,
  options: { today?: string; categories?: string[] } = {},
): CapturedDraft[] {
  return parseCaptureTextLocally(input, options).drafts;
}
