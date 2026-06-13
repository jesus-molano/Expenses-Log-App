import type {
  BankImportCandidate,
  BankImportCandidateKind,
} from "@/domain/bank-import";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type BankImportSummaryProps = {
  candidates: BankImportCandidate[];
  movementCount: number;
  language: AppLanguage;
};

export function BankImportSummary({
  candidates,
  movementCount,
  language,
}: BankImportSummaryProps) {
  const counts = countByKind(candidates);
  const reviewCount = counts.match + counts.possible;
  const newCount = counts.new_recurring + counts.new_once;

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
        value={counts.duplicate}
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
