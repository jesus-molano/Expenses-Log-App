"use client";

import { useMemo, useState } from "react";
import {
  detectBankColumns,
  bankMatrixToRows,
  matchBankMovements,
  normalizeBankMovements,
  type BankImportAnalysis,
  type BankImportCandidate,
  type BankImportIncomeCandidate,
  type BankImportIncomeDraft,
  type RawBankRow,
} from "@/domain/bank-import";
import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import {
  initialBankImportDecisions,
  initialBankImportIncomeDecisions,
  movementMatchesForTemplate,
  occurrenceDateForTemplate,
  toBankImportDecision,
  toBankIncomeImportDecision,
  type BankImportCandidateDecision,
  type BankImportIncomeCandidateDecision,
  type BankImportIncomeCandidateDecisionPatch,
} from "../lib/bank-import-decisions";

export type BankImportMode = "expenses" | "income";
export type BankImportStep = "review" | "confirm" | "applied";

export type {
  BankImportCandidateDecision,
  BankImportIncomeCandidateDecision,
  BankImportIncomeCandidateDecisionPatch,
} from "../lib/bank-import-decisions";

export type BankImportSection = {
  kind: BankImportCandidate["kind"];
  title: string;
  candidates: BankImportCandidate[];
};

export type BankImportIncomeSection = {
  kind: BankImportIncomeCandidate["kind"];
  title: string;
  candidates: BankImportIncomeCandidate[];
};

export type BankImportSelectionSummary = {
  expenses: BankImportSelectionSummaryGroup;
  income: BankImportSelectionSummaryGroup;
};

type BankImportSelectionSummaryGroup = {
  total: number;
  selected: number;
  ignored: number;
};

const SECTION_ORDER: BankImportCandidate["kind"][] = [
  "match",
  "possible",
  "new_recurring",
  "new_once",
  "duplicate",
];

const INCOME_SECTION_ORDER: BankImportIncomeCandidate["kind"][] = [
  "income_salary",
  "income_once",
  "income_duplicate",
];

export function useBankImportController() {
  const { store, confirmBankImport } = useExpenseStore();
  const language = store.preferences?.language ?? "es";
  const [analysis, setAnalysis] = useState<BankImportAnalysis | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, BankImportCandidateDecision>
  >({});
  const [incomeDecisions, setIncomeDecisions] = useState<
    Record<string, BankImportIncomeCandidateDecision>
  >({});
  const [activeMode, setActiveMode] = useState<BankImportMode>("expenses");
  const [step, setStep] = useState<BankImportStep>("review");
  const [reviewedModes, setReviewedModes] = useState<Record<BankImportMode, boolean>>({
    expenses: true,
    income: true,
  });
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

  const incomeSections = useMemo(
    () =>
      INCOME_SECTION_ORDER.map((kind) => ({
        kind,
        title: incomeSectionTitle(kind, language),
        candidates:
          analysis?.incomeCandidates.filter((candidate) => candidate.kind === kind) ?? [],
      })).filter((section) => section.candidates.length > 0),
    [analysis, language],
  );

  const selectionSummary = useMemo<BankImportSelectionSummary>(
    () => ({
      expenses: summarizeDecisions(
        analysis?.candidates.map((candidate) => decisions[candidate.id]?.action) ?? [],
      ),
      income: summarizeDecisions(
        analysis?.incomeCandidates.map((candidate) => incomeDecisions[candidate.id]?.action) ??
          [],
      ),
    }),
    [analysis, decisions, incomeDecisions],
  );

  const requiredReviewModes = useMemo<BankImportMode[]>(
    () =>
      [
        analysis?.candidates.length ? "expenses" : null,
        analysis?.incomeCandidates.length ? "income" : null,
      ].filter((mode): mode is BankImportMode => Boolean(mode)),
    [analysis],
  );
  const nextReviewMode =
    requiredReviewModes.find((mode) => !reviewedModes[mode]) ?? null;
  const canContinueToConfirm = Boolean(analysis) && !nextReviewMode;

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
      setDecisions(initialBankImportDecisions(nextAnalysis.candidates));
      setIncomeDecisions(
        initialBankImportIncomeDecisions(nextAnalysis.incomeCandidates),
      );
      const initialMode =
        nextAnalysis.candidates.length === 0 && nextAnalysis.incomeCandidates.length > 0
          ? "income"
          : "expenses";
      setActiveMode(initialMode);
      setReviewedModes({
        expenses: initialMode === "expenses" || nextAnalysis.candidates.length === 0,
        income: initialMode === "income" || nextAnalysis.incomeCandidates.length === 0,
      });
      setStep("review");
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
      if (patch.action === "create" || patch.action === "import" || patch.action === "ignore") {
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

  function updateIncomeDecision(
    candidateId: string,
    patch: BankImportIncomeCandidateDecisionPatch,
  ) {
    setIncomeDecisions((current) => {
      const existing = current[candidateId];
      if (!existing) return current;

      return {
        ...current,
        [candidateId]: {
          ...existing,
          ...patch,
          salary: {
            ...existing.salary,
            ...patch.salary,
          },
          incomeEvent: {
            ...existing.incomeEvent,
            ...patch.incomeEvent,
          },
        },
      };
    });
  }

  function updateIncomeDraft(candidateId: string, patch: Partial<BankImportIncomeDraft>) {
    updateIncomeDecision(candidateId, { incomeEvent: patch });
  }

  function updateSalaryDraft(
    candidateId: string,
    patch: Partial<BankImportIncomeCandidateDecision["salary"]>,
  ) {
    updateIncomeDecision(candidateId, { salary: patch });
  }

  function changeMode(mode: BankImportMode) {
    setActiveMode(mode);
    setReviewedModes((current) => ({
      ...current,
      [mode]: true,
    }));
  }

  function continueImportReview() {
    if (!analysis) return;

    if (nextReviewMode) {
      changeMode(nextReviewMode);
      setMessage(t("settings.bankImportReviewMissing", language));
      return;
    }

    setStep("confirm");
    setMessage("");
  }

  function backToReview() {
    setStep("review");
    setMessage("");
  }

  function applyImport() {
    if (!analysis) return;

    const nextDecisions = analysis.candidates.map((candidate) =>
      toBankImportDecision(candidate, decisions[candidate.id], store),
    );
    const nextIncomeDecisions = analysis.incomeCandidates.map((candidate) =>
      toBankIncomeImportDecision(candidate, incomeDecisions[candidate.id]),
    );

    confirmBankImport({ decisions: [...nextDecisions, ...nextIncomeDecisions] });
    setAnalysis(null);
    setDecisions({});
    setIncomeDecisions({});
    setReviewedModes({ expenses: true, income: true });
    setStep("applied");
    setMessage(t("settings.bankImportApplied", language));
  }

  return {
    store,
    language,
    analysis,
    decisions,
    incomeDecisions,
    sections,
    incomeSections,
    selectionSummary,
    step,
    activeMode,
    reviewedModes,
    canContinueToConfirm,
    nextReviewMode,
    message,
    isReading,
    setActiveMode: changeMode,
    importFile,
    updateDecision,
    updateExpenseDraft,
    updateIncomeDecision,
    updateIncomeDraft,
    updateSalaryDraft,
    continueImportReview,
    backToReview,
    applyImport,
  };
}

function summarizeDecisions(
  actions: Array<string | undefined>,
): BankImportSelectionSummaryGroup {
  const total = actions.length;
  const ignored = actions.filter((action) => action === "ignore" || !action).length;

  return {
    total,
    selected: total - ignored,
    ignored,
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

function incomeSectionTitle(
  kind: BankImportIncomeCandidate["kind"],
  language: AppLanguage,
) {
  if (kind === "income_salary") return t("settings.bankImportIncomeSalary", language);
  if (kind === "income_once") return t("settings.bankImportIncomeOneOff", language);
  return t("settings.bankImportIncomeDuplicates", language);
}
