"use client";

import { AlertTriangle } from "lucide-react";
import { formatCurrency, formatShortDate } from "@/domain/calendar";
import type { BankImportCandidate } from "@/domain/bank-import";
import type {
  AppLanguage,
  ExpenseCategory,
  DraftExpense,
  ExpenseTemplate,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { BankImportCandidateDecision } from "../hooks/use-bank-import-controller";
import {
  BankImportActionPicker,
  BankImportCreateExpenseControls,
  BankImportMatchControls,
} from "./BankImportCandidateControls";

type BankImportCandidateCardProps = {
  candidate: BankImportCandidate;
  templates: ExpenseTemplate[];
  categories: ExpenseCategory[];
  decision?: BankImportCandidateDecision;
  language: AppLanguage;
  onDecisionChange: (patch: Partial<BankImportCandidateDecision>) => void;
  onExpenseChange: (patch: Partial<DraftExpense>) => void;
};

export function BankImportCandidateCard({
  candidate,
  templates,
  categories,
  decision,
  language,
  onDecisionChange,
  onExpenseChange,
}: BankImportCandidateCardProps) {
  const isDuplicate = candidate.kind === "duplicate";

  return (
    <article className="app-import-candidate">
      <CandidateSummary candidate={candidate} language={language} />

      {decision ? (
        <div className="mt-3 grid gap-2">
          <BankImportActionPicker
            action={decision.action}
            includeImport={isDuplicate}
            canMatch={templates.length > 0}
            language={language}
            onChange={(action) => onDecisionChange({ action })}
          />

          {decision.action === "match" ? (
            <BankImportMatchControls
              templates={templates}
              categories={categories}
              templateId={decision.templateId}
              saveAlias={decision.saveAlias}
              language={language}
              onTemplateChange={(templateId) => onDecisionChange({ templateId })}
              onAliasChange={(saveAlias) => onDecisionChange({ saveAlias })}
            />
          ) : null}

          {decision.action === "create" ? (
            <BankImportCreateExpenseControls
              draft={decision.expense}
              language={language}
              onChange={onExpenseChange}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CandidateSummary({
  candidate,
  language,
}: {
  candidate: BankImportCandidate;
  language: AppLanguage;
}) {
  const amount = Math.abs(candidate.primaryMovement.amount);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0 grid gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--app-text)]">
            {candidate.suggestedName}
          </h3>
          <span className="app-import-confidence shrink-0">
            {candidate.confidence}%
          </span>
        </div>
        <p className="grid min-w-0 gap-0.5 text-xs font-medium text-[var(--app-text-muted)]">
          <span className="shrink-0 text-[var(--app-text-subtle)]">
            {formatShortDate(candidate.primaryMovement.bookedAt)}
          </span>
          <span className="app-import-bank-description">
            {candidate.primaryMovement.description}
          </span>
        </p>
        <p className="truncate text-xs font-medium text-[var(--app-text-subtle)]">
          {candidate.reason}
        </p>
        {candidate.duplicate ? (
          <DuplicateWarning
            duplicate={candidate.duplicate}
            language={language}
          />
        ) : null}
        {candidate.movements.length > 1 ? (
          <p className="text-xs font-semibold text-[var(--app-accent)]">
            {candidate.movements.length}{" "}
            {t("settings.bankImportRows", language)}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-right text-base font-semibold text-[var(--app-text)]">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function DuplicateWarning({
  duplicate,
  language,
}: {
  duplicate: NonNullable<BankImportCandidate["duplicate"]>;
  language: AppLanguage;
}) {
  return (
    <div className="app-import-duplicate-warning">
      <div className="flex min-w-0 items-center gap-1.5">
        <AlertTriangle size={13} className="shrink-0" />
        <span className="min-w-0 truncate">
          {t("settings.bankImportDuplicateProbable", language)}
          {" · "}
          {duplicate.reason}
        </span>
      </div>
      {duplicate.movement ? (
        <p className="truncate">
          {formatShortDate(duplicate.movement.bookedAt)}
          {" · "}
          {formatCurrency(Math.abs(duplicate.movement.amount))}
          {" · "}
          {duplicate.movement.description}
        </p>
      ) : null}
      <p>{t("settings.bankImportDuplicateWarning", language)}</p>
    </div>
  );
}
