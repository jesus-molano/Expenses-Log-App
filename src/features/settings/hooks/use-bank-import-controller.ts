"use client";

import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { buildDateWithDay, toDateOnly } from "@/domain/calendar";
import {
  detectBankColumns,
  bankMatrixToRows,
  matchBankMovements,
  normalizeBankMovements,
  type BankImportAnalysis,
  type BankImportCandidate,
  type RawBankRow,
} from "@/domain/bank-import";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import type { BankImportDecision } from "@/stores/app/store-types";

export type BankImportCandidateDecision = {
  action: BankImportDecision["action"];
  templateId?: string;
  occurrenceDate?: string;
  movementMatches?: NonNullable<BankImportDecision["movementMatches"]>;
  saveAlias: boolean;
  expense: DraftExpense;
};

export type BankImportSection = {
  kind: BankImportCandidate["kind"];
  title: string;
  candidates: BankImportCandidate[];
};

const SECTION_ORDER: BankImportCandidate["kind"][] = [
  "match",
  "possible",
  "new_recurring",
  "new_once",
  "duplicate",
];

export function useBankImportController() {
  const { store, confirmBankImport } = useExpenseStore();
  const language = store.preferences?.language ?? "es";
  const [analysis, setAnalysis] = useState<BankImportAnalysis | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, BankImportCandidateDecision>
  >({});
  const [message, setMessage] = useState("");
  const [isReading, setIsReading] = useState(false);

  const sections = useMemo(
    () =>
      SECTION_ORDER.map((kind) => ({
        kind,
        title: sectionTitle(kind, language),
        candidates: analysis?.candidates.filter((candidate) => candidate.kind === kind) ?? [],
      })).filter((section) => section.candidates.length > 0),
    [analysis, language],
  );

  async function importFile(file: File) {
    setIsReading(true);
    setMessage("");

    try {
      const rows = await readSpreadsheetRows(file);
      const mapping = detectBankColumns(rows);
      const movements = normalizeBankMovements(rows, mapping);
      const nextAnalysis = {
        ...matchBankMovements(store, movements),
        mapping,
      };

      setAnalysis(nextAnalysis);
      setDecisions(initialDecisions(nextAnalysis.candidates));
      setMessage(
        `${nextAnalysis.movements.length} ${t("settings.bankImportRows", language)}`,
      );
    } catch {
      setMessage(t("settings.bankImportError", language));
    } finally {
      setIsReading(false);
    }
  }

  function updateDecision(
    candidateId: string,
    patch: Partial<BankImportCandidateDecision>,
  ) {
    setDecisions((current) => {
      const existing = current[candidateId];
      if (!existing) return current;

      const next = { ...existing, ...patch };
      if (patch.action === "match") {
        next.saveAlias = true;
      }
      if (patch.action === "create" || patch.action === "ignore") {
        next.saveAlias = false;
      }

      const template = patch.templateId
        ? store.templates.find((item) => item.id === patch.templateId)
        : undefined;

      if (template) {
        const candidate = analysis?.candidates.find((item) => item.id === candidateId);
        next.occurrenceDate = candidate
          ? occurrenceDateForTemplate(template, candidate)
          : next.occurrenceDate;
        next.movementMatches = candidate
          ? movementMatchesForTemplate(template, candidate)
          : next.movementMatches;
      }

      return {
        ...current,
        [candidateId]: next,
      };
    });
  }

  function updateExpenseDraft(candidateId: string, patch: Partial<DraftExpense>) {
    setDecisions((current) => {
      const existing = current[candidateId];
      if (!existing) return current;

      return {
        ...current,
        [candidateId]: {
          ...existing,
          expense: {
            ...existing.expense,
            ...patch,
          },
        },
      };
    });
  }

  function applyImport() {
    if (!analysis) return;

    const nextDecisions = analysis.candidates.map((candidate) =>
      toImportDecision(candidate, decisions[candidate.id], store),
    );

    confirmBankImport({ decisions: nextDecisions });
    setAnalysis(null);
    setDecisions({});
    setMessage(t("settings.bankImportApplied", language));
  }

  return {
    store,
    language,
    analysis,
    decisions,
    sections,
    message,
    isReading,
    importFile,
    updateDecision,
    updateExpenseDraft,
    applyImport,
  };
}

async function readSpreadsheetRows(file: File): Promise<RawBankRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!firstSheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  return bankMatrixToRows(matrix);
}

function initialDecisions(candidates: BankImportCandidate[]) {
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

function toImportDecision(
  candidate: BankImportCandidate,
  decision: BankImportCandidateDecision | undefined,
  store: ExpenseStore,
): BankImportDecision {
  if (!decision || candidate.kind === "duplicate" || decision.action === "ignore") {
    return {
      candidateId: candidate.id,
      action: "ignore",
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

function movementMatchesForTemplate(
  template: ExpenseTemplate,
  candidate: BankImportCandidate,
) {
  return candidate.movements.map((movement) => ({
    movementId: movement.id,
    occurrenceDate: occurrenceDateForMovement(template, movement.bookedAt),
  }));
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

function occurrenceDateForTemplate(
  template: ExpenseTemplate,
  candidate: BankImportCandidate,
) {
  if (candidate.matchedTemplateId === template.id && candidate.matchedOccurrenceDate) {
    return candidate.matchedOccurrenceDate;
  }

  return occurrenceDateForMovement(template, candidate.primaryMovement.bookedAt);
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

function sectionTitle(
  kind: BankImportCandidate["kind"],
  language: AppLanguage,
) {
  if (kind === "match") return t("settings.bankImportMatches", language);
  if (kind === "possible") return t("settings.bankImportPossible", language);
  if (kind === "new_recurring") return t("settings.bankImportRecurring", language);
  if (kind === "new_once") return t("settings.bankImportOneOff", language);
  return t("settings.bankImportDuplicates", language);
}
