"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { formatCurrency, formatShortDate } from "@/domain/calendar";
import type {
  BankImportIncomeCandidate,
  BankImportIncomeDraft,
} from "@/domain/bank-import";
import type { AppLanguage } from "@/domain/types";
import { PlanPaydayField } from "@/features/plan/components/PlanPaydayField";
import { t } from "@/shared/i18n";
import type {
  BankImportIncomeCandidateDecision,
  BankImportIncomeCandidateDecisionPatch,
} from "../hooks/use-bank-import-controller";
import { BankImportIncomeActionPicker } from "./BankImportCandidateControls";

type BankImportIncomeCandidateCardProps = {
  candidate: BankImportIncomeCandidate;
  decision?: BankImportIncomeCandidateDecision;
  language: AppLanguage;
  onDecisionChange: (patch: BankImportIncomeCandidateDecisionPatch) => void;
  onIncomeChange: (patch: Partial<BankImportIncomeDraft>) => void;
  onSalaryChange: (
    patch: Partial<BankImportIncomeCandidateDecision["salary"]>,
  ) => void;
};

export function BankImportIncomeCandidateCard({
  candidate,
  decision,
  language,
  onDecisionChange,
  onIncomeChange,
  onSalaryChange,
}: BankImportIncomeCandidateCardProps) {
  const isDuplicate = candidate.kind === "income_duplicate";

  return (
    <article className="app-import-candidate">
      <IncomeCandidateSummary candidate={candidate} language={language} />

      {decision ? (
        <div className="mt-3 grid gap-2">
          <BankImportIncomeActionPicker
            action={decision.action}
            includeImport={isDuplicate}
            language={language}
            onChange={(action) => onDecisionChange({ action })}
          />

          {decision.action === "salary" ? (
            <BankImportSalaryControls
              salary={decision.salary}
              language={language}
              onChange={onSalaryChange}
            />
          ) : null}

          {decision.action === "income" ? (
            <BankImportIncomeControls
              draft={decision.incomeEvent}
              language={language}
              onChange={onIncomeChange}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function IncomeCandidateSummary({
  candidate,
  language,
}: {
  candidate: BankImportIncomeCandidate;
  language: AppLanguage;
}) {
  const amount = Math.abs(candidate.primaryMovement.amount);
  const dateLabel =
    candidate.movements.length > 1
      ? `${formatShortDate(candidate.movements[0].bookedAt)} - ${formatShortDate(
          candidate.primaryMovement.bookedAt,
        )}`
      : formatShortDate(candidate.primaryMovement.bookedAt);

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
            {dateLabel}
          </span>
          <span className="app-import-bank-description">
            {candidate.primaryMovement.description}
          </span>
        </p>
        <p className="truncate text-xs font-medium text-[var(--app-text-subtle)]">
          {candidate.reason}
        </p>
        {candidate.duplicate ? (
          <IncomeDuplicateWarning
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
      <p className="app-money shrink-0 text-right text-base font-semibold text-[var(--app-success)]">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function IncomeDuplicateWarning({
  duplicate,
  language,
}: {
  duplicate: NonNullable<BankImportIncomeCandidate["duplicate"]>;
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
          <span className="app-money">
            {formatCurrency(Math.abs(duplicate.movement.amount))}
          </span>
          {" · "}
          {duplicate.movement.description}
        </p>
      ) : null}
      <p>{t("settings.bankImportDuplicateWarning", language)}</p>
    </div>
  );
}

function BankImportSalaryControls({
  salary,
  language,
  onChange,
}: {
  salary: BankImportIncomeCandidateDecision["salary"];
  language: AppLanguage;
  onChange: (patch: Partial<BankImportIncomeCandidateDecision["salary"]>) => void;
}) {
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Field label={t("money.salary", language)} className="text-xs">
        <input
          className="input-control"
          inputMode="decimal"
          value={salary.amount}
          onChange={(event) => onChange({ amount: Number(event.target.value) })}
        />
      </Field>
      <PlanPaydayField
        language={language}
        salaryDay={salary.dayOfMonth}
        open={dayPickerOpen}
        onOpenChange={setDayPickerOpen}
        onSalaryDayChange={(dayOfMonth) => onChange({ dayOfMonth })}
      />
    </div>
  );
}

function BankImportIncomeControls({
  draft,
  language,
  onChange,
}: {
  draft: BankImportIncomeDraft;
  language: AppLanguage;
  onChange: (patch: Partial<BankImportIncomeDraft>) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <Field label={t("expenses.name", language)} className="text-xs">
          <input
            className="input-control"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
        <Field label={t("expenses.amount", language)} className="text-xs">
          <input
            className="input-control"
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => onChange({ amount: Number(event.target.value) })}
          />
        </Field>
      </div>
      <DatePickerField
        label={t("settings.bankImportIncomeDate", language)}
        value={draft.receivedAt}
        language={language}
        onChange={(receivedAt) => onChange({ receivedAt: receivedAt ?? draft.receivedAt })}
      />
    </div>
  );
}
