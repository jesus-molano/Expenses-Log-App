import { parseISO } from "date-fns";
import { buildDateWithDay, toDateOnly } from "@/domain/calendar";
import type {
  BankImportCandidate,
  BankImportIncomeCandidate,
  BankImportIncomeDraft,
} from "@/domain/bank-import";
import type { DraftExpense, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import type { BankImportDecision } from "@/stores/app/store-types";

export type BankImportCandidateDecision = {
  action: Extract<BankImportDecision["action"], "match" | "create" | "import" | "ignore">;
  templateId?: string;
  occurrenceDate?: string;
  movementMatches?: NonNullable<BankImportDecision["movementMatches"]>;
  saveAlias: boolean;
  expense: DraftExpense;
};

export type BankImportIncomeCandidateDecision = {
  action: Extract<BankImportDecision["action"], "salary" | "income" | "import" | "ignore">;
  salary: {
    amount: number;
    dayOfMonth: number;
  };
  salaryMatches?: NonNullable<BankImportDecision["salaryMatches"]>;
  incomeEvent: BankImportIncomeDraft;
};

export type BankImportIncomeCandidateDecisionPatch = Omit<
  Partial<BankImportIncomeCandidateDecision>,
  "salary" | "incomeEvent"
> & {
  salary?: Partial<BankImportIncomeCandidateDecision["salary"]>;
  incomeEvent?: Partial<BankImportIncomeDraft>;
};

export function initialBankImportDecisions(candidates: BankImportCandidate[]) {
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      {
        action: candidate.kind === "match" ? "match" : "ignore",
        templateId: candidate.matchedTemplateId,
        occurrenceDate: candidate.matchedOccurrenceDate,
        movementMatches: candidate.matchedMovements,
        saveAlias: candidate.kind === "match",
        expense: candidate.suggestedExpense,
      } satisfies BankImportCandidateDecision,
    ]),
  );
}

export function initialBankImportIncomeDecisions(
  candidates: BankImportIncomeCandidate[],
) {
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      {
        action:
          candidate.kind === "income_salary"
            ? "salary"
            : candidate.kind === "income_once"
              ? "income"
              : "ignore",
        salary: candidate.suggestedSalary ?? {
          amount: Math.max(candidate.primaryMovement.amount, 0.01),
          dayOfMonth: parseISO(candidate.primaryMovement.bookedAt).getDate(),
        },
        salaryMatches: candidate.salaryMatches,
        incomeEvent: candidate.suggestedIncome,
      } satisfies BankImportIncomeCandidateDecision,
    ]),
  );
}

export function toBankImportDecision(
  candidate: BankImportCandidate,
  decision: BankImportCandidateDecision | undefined,
  store: ExpenseStore,
): BankImportDecision {
  if (!decision || decision.action === "ignore") {
    return {
      candidateId: candidate.id,
      action: "ignore",
      movements: candidate.movements,
    };
  }

  if (decision.action === "import") {
    return {
      candidateId: candidate.id,
      action: "import",
      movements: candidate.movements,
    };
  }

  if (decision.action === "create") {
    return {
      candidateId: candidate.id,
      action: "create",
      movements: candidate.movements,
      expense: sanitizeExpenseDraft(decision.expense, candidate),
    };
  }

  const templateId = decision.templateId ?? candidate.matchedTemplateId;
  const template = store.templates.find((item) => item.id === templateId);
  const occurrenceDate =
    decision.occurrenceDate ??
    (template ? occurrenceDateForTemplate(template, candidate) : candidate.primaryMovement.bookedAt);
  const movementMatches =
    decision.movementMatches ??
    candidate.matchedMovements ??
    (template ? movementMatchesForTemplate(template, candidate) : undefined);

  return {
    candidateId: candidate.id,
    action: templateId ? "match" : "ignore",
    movements: candidate.movements,
    templateId,
    occurrenceDate,
    movementMatches,
    alias:
      decision.saveAlias && templateId
        ? {
            merchantKey: candidate.merchantKey,
            label: candidate.primaryMovement.description,
            templateId,
          }
        : undefined,
  };
}

export function toBankIncomeImportDecision(
  candidate: BankImportIncomeCandidate,
  decision: BankImportIncomeCandidateDecision | undefined,
): BankImportDecision {
  if (!decision || decision.action === "ignore") {
    return {
      candidateId: candidate.id,
      action: "ignore",
      movements: candidate.movements,
    };
  }

  if (decision.action === "import") {
    return {
      candidateId: candidate.id,
      action: "import",
      movements: candidate.movements,
    };
  }

  if (decision.action === "salary") {
    return {
      candidateId: candidate.id,
      action: "salary",
      movements: candidate.movements,
      salary: sanitizeSalaryDraft(decision.salary, candidate),
      salaryMatches: decision.salaryMatches ?? candidate.salaryMatches,
    };
  }

  return {
    candidateId: candidate.id,
    action: "income",
    movements: candidate.movements,
    incomeEvent: sanitizeIncomeDraft(decision.incomeEvent, candidate),
  };
}

export function movementMatchesForTemplate(
  template: ExpenseTemplate,
  candidate: BankImportCandidate,
) {
  return candidate.movements.map((movement) => ({
    movementId: movement.id,
    occurrenceDate: occurrenceDateForMovement(template, movement.bookedAt),
  }));
}

export function occurrenceDateForTemplate(
  template: ExpenseTemplate,
  candidate: BankImportCandidate,
) {
  if (candidate.matchedTemplateId === template.id && candidate.matchedOccurrenceDate) {
    return candidate.matchedOccurrenceDate;
  }

  return occurrenceDateForMovement(template, candidate.primaryMovement.bookedAt);
}

function sanitizeSalaryDraft(
  salary: BankImportIncomeCandidateDecision["salary"],
  candidate: BankImportIncomeCandidate,
) {
  const fallback = candidate.suggestedSalary ?? {
    amount: Math.max(candidate.primaryMovement.amount, 0.01),
    dayOfMonth: parseISO(candidate.primaryMovement.bookedAt).getDate(),
  };

  return {
    amount: Math.max(Number(salary.amount), 0.01) || fallback.amount,
    dayOfMonth: Math.min(
      Math.max(Math.round(Number(salary.dayOfMonth) || fallback.dayOfMonth), 1),
      31,
    ),
  };
}

function sanitizeIncomeDraft(
  draft: BankImportIncomeDraft,
  candidate: BankImportIncomeCandidate,
): BankImportIncomeDraft {
  const fallback = candidate.suggestedIncome;

  return {
    name: draft.name.trim() || fallback.name || candidate.suggestedName,
    amount: Math.max(Number(draft.amount), 0.01) || fallback.amount,
    receivedAt: draft.receivedAt || fallback.receivedAt || candidate.primaryMovement.bookedAt,
    note: draft.note?.trim() || fallback.note,
  };
}

function sanitizeExpenseDraft(
  draft: DraftExpense,
  candidate: BankImportCandidate,
): DraftExpense {
  const startDate = draft.startDate || candidate.primaryMovement.bookedAt;
  const dueDay = Number.isFinite(Number(draft.dueDay))
    ? Math.min(Math.max(Number(draft.dueDay), 1), 31)
    : parseISO(startDate).getDate();

  return {
    ...draft,
    name: draft.name.trim() || candidate.suggestedName,
    description: draft.description.trim() || candidate.primaryMovement.description,
    categoryName: draft.categoryName.trim() || "General",
    amount: Math.max(Number(draft.amount), 0.01),
    startDate,
    dueDay,
  };
}

function occurrenceDateForMovement(template: ExpenseTemplate, bookedAt: string) {
  if (
    template.recurrence.frequency === "once" ||
    (template.recurrence.frequency === "custom" &&
      ["day", "week"].includes(template.recurrence.unit ?? ""))
  ) {
    return bookedAt;
  }

  return toDateOnly(buildDateWithDay(parseISO(bookedAt), template.dueDay));
}
