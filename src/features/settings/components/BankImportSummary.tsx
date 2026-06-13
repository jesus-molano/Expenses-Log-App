import type {
  BankImportCandidate,
  BankImportCandidateKind,
  BankImportIncomeCandidate,
  BankImportIncomeCandidateKind,
} from "@/domain/bank-import";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type BankImportSummaryProps = {
  candidates: BankImportCandidate[];
  incomeCandidates?: BankImportIncomeCandidate[];
  movementCount: number;
  language: AppLanguage;
  mode?: "expenses" | "income";
};

export function BankImportSummary({
  candidates,
  incomeCandidates = [],
  movementCount,
  language,
  mode = "expenses",
}: BankImportSummaryProps) {
  const expenseCounts = countByKind(candidates);
  const incomeCounts = countIncomeByKind(incomeCandidates);
  const reviewCount =
    mode === "income"
      ? incomeCounts.income_salary + incomeCounts.income_once
      : expenseCounts.match + expenseCounts.possible;
  const newCount =
    mode === "income"
      ? incomeCounts.income_once
      : expenseCounts.new_recurring + expenseCounts.new_once;
  const duplicateCount =
    mode === "income" ? incomeCounts.income_duplicate : expenseCounts.duplicate;

  return (
    <div className="app-import-summary mt-4" aria-label={t("settings.bankImportSummary", language)}>
      <SummaryPill
        label={t("settings.bankImportSummaryMovements", language)}
        value={movementCount}
      />
      <SummaryPill
        label={t("settings.bankImportSummaryReview", language)}
        value={reviewCount}
      />
      <SummaryPill
        label={t("settings.bankImportSummaryNew", language)}
        value={newCount}
      />
      <SummaryPill
        label={t("settings.bankImportSummaryDuplicates", language)}
        value={duplicateCount}
      />
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="app-import-summary-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function countIncomeByKind(candidates: BankImportIncomeCandidate[]) {
  return candidates.reduce<Record<BankImportIncomeCandidateKind, number>>(
    (counts, candidate) => ({
      ...counts,
      [candidate.kind]: counts[candidate.kind] + 1,
    }),
    {
      income_salary: 0,
      income_once: 0,
      income_duplicate: 0,
    },
  );
}

function countByKind(candidates: BankImportCandidate[]) {
  return candidates.reduce<Record<BankImportCandidateKind, number>>(
    (counts, candidate) => ({
      ...counts,
      [candidate.kind]: counts[candidate.kind] + 1,
    }),
    {
      match: 0,
      possible: 0,
      new_recurring: 0,
      new_once: 0,
      duplicate: 0,
    },
  );
}
