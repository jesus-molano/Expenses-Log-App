import { parseISO } from "date-fns";
import {
  type BankImportDuplicateInfo,
  inferRecurringDueDay,
  simpleHash,
  titleFromMovement,
} from "./bank-import-utils";
import type { BankMovement } from "./types";

export type BankImportIncomeCandidateKind =
  | "income_salary"
  | "income_once"
  | "income_duplicate";

export type BankImportIncomeCandidate = {
  id: string;
  kind: BankImportIncomeCandidateKind;
  confidence: number;
  movements: BankMovement[];
  primaryMovement: BankMovement;
  payerKey: string;
  suggestedName: string;
  suggestedIncome: BankImportIncomeDraft;
  suggestedSalary?: {
    amount: number;
    dayOfMonth: number;
  };
  salaryMatches?: BankImportSalaryMatch[];
  duplicate?: BankImportDuplicateInfo;
  reason: string;
};

export type BankImportSalaryMatch = {
  movementId: string;
  monthId: string;
};

export type BankImportIncomeDraft = {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
};

export function buildIncomeCandidates(
  incomes: BankMovement[],
  existingMovementsByFingerprint: Map<string, BankMovement>,
): BankImportIncomeCandidate[] {
  const candidates: BankImportIncomeCandidate[] = [];
  const unmatched: BankMovement[] = [];
  const seenImportMovementsByFingerprint = new Map<string, BankMovement>();

  for (const movement of incomes) {
    const existingMovement = existingMovementsByFingerprint.get(movement.fingerprint);
    const repeatedMovement = seenImportMovementsByFingerprint.get(movement.fingerprint);

    if (existingMovement || repeatedMovement) {
      candidates.push(
        buildIncomeDuplicateCandidate(
          movement,
          existingMovement
            ? {
                source: "existing",
                movement: existingMovement,
                reason: "Ya existe un movimiento igual importado",
              }
            : {
                source: "import",
                movement: repeatedMovement,
                reason: "Repetido dentro de este archivo",
              },
        ),
      );
      continue;
    }

    seenImportMovementsByFingerprint.set(movement.fingerprint, movement);
    unmatched.push(movement);
  }

  const usedMovementIds = new Set<string>();
  for (const groupMovements of detectIncomeSalaryGroups(unmatched)) {
    candidates.push(buildSalaryCandidate(groupMovements));
    groupMovements.forEach((movement) => usedMovementIds.add(movement.id));
  }

  for (const movement of unmatched) {
    if (usedMovementIds.has(movement.id)) continue;
    candidates.push(buildIncomeOnceCandidate(movement));
  }

  return candidates.sort((left, right) => {
    const kindOrder = incomeKindOrder(left.kind) - incomeKindOrder(right.kind);
    if (kindOrder !== 0) return kindOrder;
    return right.primaryMovement.bookedAt.localeCompare(left.primaryMovement.bookedAt);
  });
}

function buildIncomeDuplicateCandidate(
  movement: BankMovement,
  duplicate: BankImportDuplicateInfo,
): BankImportIncomeCandidate {
  return {
    id: `income-duplicate-${movement.id}`,
    kind: "income_duplicate",
    confidence: 100,
    movements: [movement],
    primaryMovement: movement,
    payerKey: movement.merchantKey,
    suggestedName: titleFromMovement(movement, "Ingreso duplicado"),
    suggestedIncome: incomeDraftFromMovement(movement),
    duplicate,
    reason: duplicate.reason,
  };
}

function buildSalaryCandidate(movements: BankMovement[]): BankImportIncomeCandidate {
  const sorted = [...movements].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  const primaryMovement = sorted[sorted.length - 1];
  const typicalAmount = median(monthlyIncomeSums(sorted));
  const dayOfMonth = inferRecurringDueDay(sorted) ?? parseISO(primaryMovement.bookedAt).getDate();

  return {
    id: `income-salary-${simpleHash(sorted.map((movement) => movement.id).join("|"))}`,
    kind: "income_salary",
    confidence: 76,
    movements: sorted,
    primaryMovement,
    payerKey: primaryMovement.merchantKey,
    suggestedName: titleFromMovement(primaryMovement, "Nomina"),
    suggestedIncome: incomeDraftFromMovement(primaryMovement),
    suggestedSalary: {
      amount: Number(typicalAmount.toFixed(2)),
      dayOfMonth,
    },
    salaryMatches: sorted.map((movement) => ({
      movementId: movement.id,
      monthId: movement.bookedAt.slice(0, 7),
    })),
    reason: "Ingreso mensual recurrente",
  };
}

function buildIncomeOnceCandidate(movement: BankMovement): BankImportIncomeCandidate {
  return {
    id: `income-once-${movement.id}`,
    kind: "income_once",
    confidence: 58,
    movements: [movement],
    primaryMovement: movement,
    payerKey: movement.merchantKey,
    suggestedName: titleFromMovement(movement, "Ingreso"),
    suggestedIncome: incomeDraftFromMovement(movement),
    reason: "Ingreso puntual no vinculado",
  };
}

function incomeDraftFromMovement(movement: BankMovement): BankImportIncomeDraft {
  return {
    name: titleFromMovement(movement, "Ingreso"),
    amount: Math.max(Number(movement.amount), 0.01),
    receivedAt: movement.bookedAt,
    note: movement.description,
  };
}

function detectIncomeSalaryGroups(movements: BankMovement[]) {
  const groups = new Map<string, BankMovement[]>();

  for (const movement of movements.filter((item) => item.amount > 0)) {
    groups.set(movement.merchantKey, [...(groups.get(movement.merchantKey) ?? []), movement]);
  }

  return Array.from(groups.values()).filter(isSalaryLikeIncomeGroup);
}

function isSalaryLikeIncomeGroup(movements: BankMovement[]) {
  if (distinctMonthCount(movements) < 2) return false;

  const monthIndexes = Array.from(
    new Set(movements.map((movement) => monthIndex(movement.bookedAt))),
  ).sort((a, b) => a - b);
  const monthGaps = monthIndexes.slice(1).map((month, index) => month - monthIndexes[index]);

  return monthGaps.every((gap) => gap >= 1 && gap <= 2);
}

function distinctMonthCount(movements: BankMovement[]) {
  return new Set(movements.map((movement) => movement.bookedAt.slice(0, 7))).size;
}

function monthlyIncomeSums(movements: BankMovement[]) {
  const sums = new Map<string, number>();

  for (const movement of movements) {
    const monthId = movement.bookedAt.slice(0, 7);
    sums.set(monthId, (sums.get(monthId) ?? 0) + Math.max(movement.amount, 0));
  }

  return Array.from(sums.values());
}

function median(values: number[]) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function monthIndex(date: string) {
  const [year, month] = date.split("-").map(Number);
  return year * 12 + month;
}

function incomeKindOrder(kind: BankImportIncomeCandidateKind) {
  if (kind === "income_salary") return 0;
  if (kind === "income_once") return 1;
  return 2;
}
