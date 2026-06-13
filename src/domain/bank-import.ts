import { addDays, differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { buildDateWithDay, estimateChargeDate, toDateOnly } from "./calendar";
import { generateOccurrences } from "./recurrence";
import type {
  BankMovement,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
  RecurrenceRule,
} from "./types";

export type BankColumnMapping = {
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  balanceColumn?: string;
  accountColumn?: string;
};

export type RawBankRow = Record<string, unknown>;

export type RawBankMatrix = unknown[][];

export type BankMovementGroup = {
  id: string;
  movements: BankMovement[];
  merchantKey: string;
  averageAmount: number;
  recurrence: RecurrenceRule | null;
};

export type BankImportCandidateKind =
  | "match"
  | "possible"
  | "new_recurring"
  | "new_once"
  | "duplicate";

export type BankImportCandidate = {
  id: string;
  kind: BankImportCandidateKind;
  confidence: number;
  movements: BankMovement[];
  primaryMovement: BankMovement;
  merchantKey: string;
  suggestedName: string;
  suggestedExpense: DraftExpense;
  matchedTemplateId?: string;
  matchedOccurrenceDate?: string;
  matchedMovements?: BankImportMovementMatch[];
  reason: string;
};

export type BankImportMovementMatch = {
  movementId: string;
  occurrenceDate: string;
};

export type BankImportAnalysis = {
  mapping: BankColumnMapping;
  movements: BankMovement[];
  candidates: BankImportCandidate[];
};

type MatchResult = {
  score: number;
  occurrence: ExpenseOccurrence;
  reason: string;
};

const DATE_HINTS = ["fecha", "date", "operativa", "operacion", "operación", "valor"];
const DESCRIPTION_HINTS = [
  "descripcion",
  "descripción",
  "concepto",
  "detalle",
  "movimiento",
  "comercio",
  "merchant",
];
const AMOUNT_HINTS = ["importe", "amount", "cantidad", "total"];
const DEBIT_HINTS = ["cargo", "debe", "debit", "retirada", "withdrawal"];
const CREDIT_HINTS = ["abono", "haber", "credit", "ingreso"];
const BALANCE_HINTS = ["saldo", "disponible", "balance"];
const ACCOUNT_HINTS = ["cuenta", "account", "iban"];
const NOISE_WORDS = new Set([
  "applecom",
  "bill",
  "compra",
  "pago",
  "tarjeta",
  "card",
  "visa",
  "mastercard",
  "paypal",
  "recibo",
  "domiciliacion",
  "domiciliación",
  "sepa",
  "es",
  "esp",
  "online",
]);

export function detectBankColumns(rows: RawBankRow[]): BankColumnMapping {
  const headers = Object.keys(rows[0] ?? {});

  return {
    dateColumn: findHeader(headers, DATE_HINTS),
    descriptionColumn: findHeader(headers, DESCRIPTION_HINTS),
    amountColumn: findHeader(headers, AMOUNT_HINTS),
    debitColumn: findHeader(headers, DEBIT_HINTS),
    creditColumn: findHeader(headers, CREDIT_HINTS),
    balanceColumn: findHeader(headers, BALANCE_HINTS),
    accountColumn: findHeader(headers, ACCOUNT_HINTS),
  };
}

export function bankMatrixToRows(matrix: RawBankMatrix): RawBankRow[] {
  const headerIndex = findBankHeaderRowIndex(matrix);
  if (headerIndex < 0) return [];

  const headers = matrix[headerIndex].map((cell, index) =>
    String(cell || `Columna ${index + 1}`).trim(),
  );
  const account = findMetadataValue(matrix.slice(0, headerIndex), ACCOUNT_HINTS);

  return matrix
    .slice(headerIndex + 1)
    .map((row) => rowToRecord(headers, row, account))
    .filter((row) => Object.values(row).some((value) => String(value).trim()));
}

export function normalizeBankMovements(
  rows: RawBankRow[],
  mapping: BankColumnMapping = detectBankColumns(rows),
): BankMovement[] {
  const importBatchId = `batch-${Date.now().toString(36)}`;

  return rows
    .map((row, index) => normalizeBankMovement(row, mapping, importBatchId, index))
    .filter((movement): movement is BankMovement => Boolean(movement));
}

export function detectRecurringMovementGroups(
  movements: BankMovement[],
): BankMovementGroup[] {
  const groups = new Map<string, BankMovement[]>();

  for (const movement of movements.filter((item) => item.amount < 0)) {
    const amountBucket = Math.round(Math.abs(movement.amount) * 100);
    const key = `${movement.merchantKey}:${amountBucket}`;
    groups.set(key, [...(groups.get(key) ?? []), movement]);
  }

  return Array.from(groups.entries()).map(([id, groupMovements]) => {
    const sorted = groupMovements.sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
    const recurrence = classifyMovementType(sorted);
    const averageAmount =
      sorted.reduce((sum, item) => sum + Math.abs(item.amount), 0) /
      Math.max(sorted.length, 1);

    return {
      id,
      movements: sorted,
      merchantKey: sorted[0]?.merchantKey ?? "",
      averageAmount,
      recurrence,
    };
  });
}

export function classifyMovementType(
  movements: BankMovement[],
): RecurrenceRule | null {
  const months = new Set(movements.map((movement) => movement.bookedAt.slice(0, 7)));
  if (months.size < 2) return null;

  const dayGaps = movements
    .slice(1)
    .map((movement, index) =>
      Math.abs(
        differenceInCalendarDays(
          parseISO(movement.bookedAt),
          parseISO(movements[index].bookedAt),
        ),
      ),
    );
  const averageGap =
    dayGaps.reduce((sum, gap) => sum + gap, 0) / Math.max(dayGaps.length, 1);

  if (averageGap >= 25 && averageGap <= 36) return { frequency: "monthly" };
  if (averageGap >= 80 && averageGap <= 100) return { frequency: "quarterly" };
  if (averageGap >= 350 && averageGap <= 380) return { frequency: "yearly" };

  return { frequency: "custom", interval: Math.max(Math.round(averageGap), 1), unit: "day" };
}

export function matchBankMovements(
  store: ExpenseStore,
  movements: BankMovement[],
): BankImportAnalysis {
  const mapping = detectBankColumns([]);
  const existingFingerprints = new Set(
    store.bankMovements.map((movement) => movement.fingerprint),
  );
  const expenses = movements.filter((movement) => movement.amount < 0);
  const dateRange = movementDateRange(expenses);
  const occurrences = dateRange
    ? generateOccurrences(
        store.templates,
        store.overrides,
        dateRange.from,
        dateRange.to,
        store.preferences?.language ?? "es",
      )
    : [];
  const candidates: BankImportCandidate[] = [];
  const unmatched: BankMovement[] = [];
  const seenImportFingerprints = new Set<string>();

  for (const movement of expenses) {
    if (
      existingFingerprints.has(movement.fingerprint) ||
      seenImportFingerprints.has(movement.fingerprint)
    ) {
      candidates.push(buildDuplicateCandidate(movement));
      continue;
    }
    seenImportFingerprints.add(movement.fingerprint);

    const match = bestMatch(store, occurrences, movement);
    if (match && match.score >= 86) {
      candidates.push(buildMatchCandidate(movement, match, "match"));
      continue;
    }
    if (match && match.score >= 58) {
      candidates.push(buildMatchCandidate(movement, match, "possible"));
      continue;
    }

    unmatched.push(movement);
  }

  const usedNewMovementIds = new Set<string>();
  for (const group of detectRecurringMovementGroups(unmatched)) {
    if (!group.recurrence || group.movements.length < 2) continue;

    const candidate = buildNewExpenseCandidate(group.movements, "new_recurring", group.recurrence);
    candidates.push(candidate);
    group.movements.forEach((movement) => usedNewMovementIds.add(movement.id));
  }

  for (const movement of unmatched) {
    if (usedNewMovementIds.has(movement.id)) continue;
    candidates.push(buildNewExpenseCandidate([movement], "new_once", { frequency: "once" }));
  }

  return {
    mapping,
    movements,
    candidates: groupEquivalentMatchCandidates(candidates),
  };
}

export function normalizeMerchantKey(description: string): string {
  const compact = normalizeText(description).replace(/\s+/g, "");
  if (compact.includes("apple")) return "apple";
  if (compact.includes("google")) return "google";
  if (compact.includes("openai")) return "openai";
  if (compact.includes("netflix")) return "netflix";
  if (compact.includes("spotify")) return "spotify";

  const tokens = normalizeText(description)
    .split(" ")
    .filter((token) => token.length > 2 && !NOISE_WORDS.has(token));

  return tokens.slice(0, 4).join(" ") || normalizeText(description).slice(0, 40);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeBankMovement(
  row: RawBankRow,
  mapping: BankColumnMapping,
  importBatchId: string,
  rowIndex: number,
): BankMovement | null {
  const bookedAt = parseBankDate(readCell(row, mapping.dateColumn));
  const description = readCell(row, mapping.descriptionColumn);
  const amount = parseMovementAmount(row, mapping);

  if (!bookedAt || !description || !Number.isFinite(amount) || amount === 0) {
    return null;
  }

  const balance = parseMoney(readCell(row, mapping.balanceColumn));
  const account = readCell(row, mapping.accountColumn);
  const merchantKey = normalizeMerchantKey(description);
  const fingerprint = movementFingerprint({
    bookedAt,
    description,
    amount,
    account,
  });

  return {
    id: `mov-${fingerprint}-${rowIndex.toString(36)}`,
    userId: "demo",
    fingerprint,
    bookedAt,
    description,
    amount,
    currency: "EUR",
    account: account || undefined,
    balance: Number.isFinite(balance) ? balance : undefined,
    merchantKey,
    importBatchId,
    createdAt: new Date().toISOString(),
  };
}

function parseMovementAmount(row: RawBankRow, mapping: BankColumnMapping): number {
  if (mapping.amountColumn) return parseMoney(readCell(row, mapping.amountColumn));

  const debit = parseMoney(readCell(row, mapping.debitColumn));
  const credit = parseMoney(readCell(row, mapping.creditColumn));

  if (Number.isFinite(debit) && Math.abs(debit) > 0) return -Math.abs(debit);
  if (Number.isFinite(credit) && Math.abs(credit) > 0) return Math.abs(credit);

  return Number.NaN;
}

function parseBankDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const excelSerial = Number(trimmed);
  if (Number.isFinite(excelSerial) && excelSerial > 20_000 && excelSerial < 80_000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + excelSerial);
    return toDateOnly(epoch);
  }

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return toDateOnly(
      new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])),
    );
  }

  const euMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (euMatch) {
    const year = Number(euMatch[3].length === 2 ? `20${euMatch[3]}` : euMatch[3]);
    return toDateOnly(new Date(year, Number(euMatch[2]) - 1, Number(euMatch[1])));
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : toDateOnly(date);
}

function parseMoney(value: string): number {
  const trimmed = value
    .replace(/\s/g, "")
    .replace(/[€$]/g, "")
    .replace(/\((.+)\)/, "-$1");
  if (!trimmed) return Number.NaN;

  const normalized =
    trimmed.includes(",") && trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");

  return Number(normalized);
}

function readCell(row: RawBankRow, key?: string): string {
  if (!key) return "";
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

function findHeader(headers: string[], hints: string[]) {
  for (const hint of hints) {
    const normalizedHint = normalizeText(hint);
    const header = headers.find((item) =>
      normalizeText(item).includes(normalizedHint),
    );
    if (header) return header;
  }

  return undefined;
}

function findBankHeaderRowIndex(matrix: RawBankMatrix) {
  return matrix.findIndex((row) => {
    const headers = row.map((cell) => String(cell ?? ""));
    const mapping = {
      dateColumn: findHeader(headers, DATE_HINTS),
      descriptionColumn: findHeader(headers, DESCRIPTION_HINTS),
      amountColumn: findHeader(headers, AMOUNT_HINTS),
      debitColumn: findHeader(headers, DEBIT_HINTS),
      creditColumn: findHeader(headers, CREDIT_HINTS),
    };

    return Boolean(
      mapping.dateColumn &&
        mapping.descriptionColumn &&
        (mapping.amountColumn || mapping.debitColumn || mapping.creditColumn),
    );
  });
}

function rowToRecord(headers: string[], row: unknown[], account?: string): RawBankRow {
  const record = headers.reduce<RawBankRow>((current, header, index) => {
    if (!header) return current;
    return {
      ...current,
      [header]: row[index] ?? "",
    };
  }, {});

  if (account && !findHeader(Object.keys(record), ACCOUNT_HINTS)) {
    record.Cuenta = account;
  }

  return record;
}

function findMetadataValue(matrix: RawBankMatrix, hints: string[]) {
  for (const row of matrix) {
    for (let index = 0; index < row.length - 1; index += 1) {
      const label = normalizeText(String(row[index] ?? ""));
      if (hints.some((hint) => label.includes(normalizeText(hint)))) {
        const value = String(row[index + 1] ?? "").trim();
        if (value) return value;
      }
    }
  }

  return undefined;
}

function movementFingerprint(input: {
  bookedAt: string;
  description: string;
  amount: number;
  account: string;
}) {
  return simpleHash(
    [
      input.bookedAt,
      normalizeText(input.description),
      input.amount.toFixed(2),
      normalizeText(input.account),
    ].join("|"),
  );
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function movementDateRange(movements: BankMovement[]) {
  if (!movements.length) return null;

  const sorted = [...movements].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  return {
    from: toDateOnly(subDays(parseISO(sorted[0].bookedAt), 5)),
    to: toDateOnly(addDays(parseISO(sorted[sorted.length - 1].bookedAt), 5)),
  };
}

function bestMatch(
  store: ExpenseStore,
  occurrences: ExpenseOccurrence[],
  movement: BankMovement,
): MatchResult | null {
  if (!occurrences.length) return null;

  const aliasTemplateIds = store.bankMerchantAliases
    .filter((alias) => alias.merchantKey === movement.merchantKey)
    .map((alias) => alias.templateId);

  return occurrences.reduce<MatchResult>(
    (best, occurrence) => {
      const score = matchScore(movement, occurrence, aliasTemplateIds);
      if (score <= best.score) return best;

      return {
        score,
        occurrence,
        reason: matchReason(score, movement, occurrence),
      };
    },
    { score: 0, occurrence: occurrences[0], reason: "" },
  );
}

function matchScore(
  movement: BankMovement,
  occurrence: ExpenseOccurrence,
  aliasTemplateIds: string[],
) {
  const bankAmount = Math.abs(movement.amount);
  const expenseAmount = occurrence.template.amount;
  const amountDiff = Math.abs(bankAmount - expenseAmount);
  const chargeDateDelta = Math.min(
    Math.abs(differenceInCalendarDays(parseISO(movement.bookedAt), parseISO(occurrence.dueDate))),
    Math.abs(
      differenceInCalendarDays(
        parseISO(movement.bookedAt),
        parseISO(occurrence.estimatedChargeDate),
      ),
    ),
  );
  const templateName = normalizeText(occurrence.template.name);
  const merchantName = movement.merchantKey;
  const aliasMatch = aliasTemplateIds.includes(occurrence.template.id);
  const tokenOverlap = textOverlap(templateName, merchantName);

  let score = 0;
  if (amountDiff <= 0.01) score += 42;
  else if (amountDiff <= 1) score += 35;
  else if (amountDiff / Math.max(expenseAmount, 1) <= 0.05) score += 24;

  if (chargeDateDelta <= 1) score += 30;
  else if (chargeDateDelta <= 4) score += 22;

  if (aliasMatch) score += 35;
  else if (templateName.includes(merchantName) || merchantName.includes(templateName)) score += 24;
  else score += Math.round(tokenOverlap * 22);

  if (occurrence.status === "paid") score -= 18;

  return Math.max(score, 0);
}

function textOverlap(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = right.split(" ").filter(Boolean);
  if (!leftTokens.size || !rightTokens.length) return 0;
  const matches = rightTokens.filter((token) => leftTokens.has(token)).length;
  return matches / Math.max(rightTokens.length, 1);
}

function matchReason(
  score: number,
  movement: BankMovement,
  occurrence: ExpenseOccurrence,
) {
  if (score >= 86) {
    return `${movement.description} coincide con ${occurrence.template.name}`;
  }

  return `${movement.description} podria ser ${occurrence.template.name}`;
}

function buildDuplicateCandidate(movement: BankMovement): BankImportCandidate {
  return {
    id: `candidate-duplicate-${movement.id}`,
    kind: "duplicate",
    confidence: 100,
    movements: [movement],
    primaryMovement: movement,
    merchantKey: movement.merchantKey,
    suggestedName: titleFromMerchant(movement),
    suggestedExpense: draftFromMovement([movement], { frequency: "once" }),
    reason: "Movimiento ya importado",
  };
}

function buildMatchCandidate(
  movement: BankMovement,
  match: MatchResult,
  kind: Extract<BankImportCandidateKind, "match" | "possible">,
): BankImportCandidate {
  return {
    id: `candidate-${kind}-${movement.id}`,
    kind,
    confidence: Math.min(match.score, 100),
    movements: [movement],
    primaryMovement: movement,
    merchantKey: movement.merchantKey,
    suggestedName: match.occurrence.template.name,
    suggestedExpense: draftFromMovement([movement], match.occurrence.template.recurrence),
    matchedTemplateId: match.occurrence.template.id,
    matchedOccurrenceDate: match.occurrence.occurrenceDate,
    matchedMovements: [
      {
        movementId: movement.id,
        occurrenceDate: match.occurrence.occurrenceDate,
      },
    ],
    reason: match.reason,
  };
}

function groupEquivalentMatchCandidates(candidates: BankImportCandidate[]) {
  const grouped = new Map<string, BankImportCandidate>();
  const passthrough: BankImportCandidate[] = [];

  for (const candidate of candidates) {
    if (
      !["match", "possible"].includes(candidate.kind) ||
      !candidate.matchedTemplateId
    ) {
      passthrough.push(candidate);
      continue;
    }

    const amountBucket = Math.round(Math.abs(candidate.primaryMovement.amount) * 100);
    const key = [candidate.matchedTemplateId, candidate.merchantKey, amountBucket].join(
      "|",
    );
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, candidate);
      continue;
    }

    grouped.set(key, mergeMatchCandidates(existing, candidate));
  }

  return [...grouped.values(), ...passthrough];
}

function mergeMatchCandidates(
  left: BankImportCandidate,
  right: BankImportCandidate,
): BankImportCandidate {
  const movements = [...left.movements, ...right.movements].sort((a, b) =>
    a.bookedAt.localeCompare(b.bookedAt),
  );
  const primaryMovement = movements[movements.length - 1];
  const matchedMovements = [
    ...(left.matchedMovements ?? []),
    ...(right.matchedMovements ?? []),
  ];
  const mergedKind =
    left.kind === "match" && right.kind === "match" ? "match" : "possible";

  return {
    ...left,
    id: `candidate-${mergedKind}-${simpleHash(movements.map((movement) => movement.id).join("|"))}`,
    kind: mergedKind,
    confidence: Math.min(left.confidence, right.confidence),
    movements,
    primaryMovement,
    matchedOccurrenceDate:
      matchedMovements.find((match) => match.movementId === primaryMovement.id)
        ?.occurrenceDate ?? left.matchedOccurrenceDate,
    matchedMovements,
    reason:
      movements.length > 1
        ? `${left.suggestedName}: ${movements.length} movimientos vinculables`
        : left.reason,
  };
}

function buildNewExpenseCandidate(
  movements: BankMovement[],
  kind: Extract<BankImportCandidateKind, "new_recurring" | "new_once">,
  recurrence: RecurrenceRule,
): BankImportCandidate {
  const primaryMovement = movements[movements.length - 1];

  return {
    id: `candidate-${kind}-${primaryMovement.id}`,
    kind,
    confidence: kind === "new_recurring" ? 72 : 54,
    movements,
    primaryMovement,
    merchantKey: primaryMovement.merchantKey,
    suggestedName: titleFromMerchant(primaryMovement),
    suggestedExpense: draftFromMovement(movements, recurrence),
    reason:
      kind === "new_recurring"
        ? "Movimiento recurrente no vinculado"
        : "Movimiento unico no vinculado",
  };
}

function draftFromMovement(
  movements: BankMovement[],
  recurrence: RecurrenceRule,
): DraftExpense {
  const sorted = [...movements].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  const latest = sorted[sorted.length - 1];
  const dueDay = inferRecurringDueDay(sorted);
  const startDate = dueDay
    ? toDateOnly(buildDateWithDay(parseISO(latest.bookedAt), dueDay))
    : latest.bookedAt;
  const averageAmount =
    movements.reduce((sum, movement) => sum + Math.abs(movement.amount), 0) /
    Math.max(movements.length, 1);

  return {
    name: titleFromMerchant(latest),
    description: latest.description,
    amount: Number(averageAmount.toFixed(2)),
    categoryName: "General",
    startDate,
    dueDay: dueDay ?? parseISO(latest.bookedAt).getDate(),
    recurrence,
  };
}

function inferRecurringDueDay(movements: BankMovement[]) {
  if (!movements.length) return null;

  const scoredDays = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const score = movements.reduce(
      (sum, movement) => sum + weekendAwareDayDistance(movement.bookedAt, day),
      0,
    );

    return { day, score };
  }).sort((a, b) => a.score - b.score || a.day - b.day);

  return scoredDays[0]?.score <= movements.length * 2 ? scoredDays[0].day : null;
}

function weekendAwareDayDistance(bookedAt: string, dueDay: number) {
  const bookedDate = parseISO(bookedAt);
  const dueDate = toDateOnly(buildDateWithDay(bookedDate, dueDay));
  const estimatedCharge = estimateChargeDate(dueDate).date;

  return Math.min(
    Math.abs(differenceInCalendarDays(bookedDate, parseISO(dueDate))),
    Math.abs(differenceInCalendarDays(bookedDate, parseISO(estimatedCharge))),
  );
}

function titleFromMerchant(movement: BankMovement) {
  return movement.merchantKey
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ") || "Nuevo gasto";
}
