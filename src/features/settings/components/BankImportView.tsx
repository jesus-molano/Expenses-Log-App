"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUp, Check, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { BankImportFilePanel } from "./BankImportFilePanel";
import { BankImportReviewSections } from "./BankImportReviewSections";
import { BankImportSummary } from "./BankImportSummary";
import type {
  BankImportMode,
  BankImportSelectionSummary,
} from "../hooks/use-bank-import-controller";
import { useBankImportController } from "../hooks/use-bank-import-controller";

export function BankImportView({ from }: { from?: "money" | "settings" }) {
  const controller = useBankImportController();
  const backHref = from === "money" ? "/money" : "/settings";
  const backLabel =
    from === "money"
      ? t("common.plan", controller.language)
      : t("common.settings", controller.language);

  return (
    <main className="app-page app-page-safe px-4">
      <div
        className="app-import-content mx-auto max-w-3xl pb-24"
        data-has-action={controller.analysis ? "true" : "false"}
      >
        <Link
          href={backHref}
          className="app-back-link inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          {backLabel}
        </Link>

        <header className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[var(--app-text)]">
              {t("settings.bankImportTitle", controller.language)}
            </h1>
            <p className="mt-1 text-sm font-medium leading-snug text-[var(--app-text-muted)]">
              {t("settings.bankImportSubtitle", controller.language)}
            </p>
          </div>
          <span className="app-import-header-icon">
            <FileSpreadsheet size={20} />
          </span>
        </header>

        <BankImportFilePanel
          isReading={controller.isReading}
          message={controller.message}
          language={controller.language}
          onFile={controller.importFile}
        />

        {controller.analysis ? (
          <>
            <BankImportSummary
              candidates={controller.analysis.candidates}
              incomeCandidates={controller.analysis.incomeCandidates}
              movementCount={controller.analysis.movements.length}
              language={controller.language}
              mode={controller.activeMode}
            />

            {controller.step === "confirm" ? (
              <BankImportConfirmPanel
                summary={controller.selectionSummary}
                language={controller.language}
                onBack={controller.backToReview}
              />
            ) : (
              <>
                <BankImportModeTabs
                  activeMode={controller.activeMode}
                  expenseCount={controller.analysis.candidates.length}
                  incomeCount={controller.analysis.incomeCandidates.length}
                  reviewedModes={controller.reviewedModes}
                  language={controller.language}
                  onChange={controller.setActiveMode}
                />

                <BankImportReviewSections
                  sections={controller.sections}
                  incomeSections={controller.incomeSections}
                  mode={controller.activeMode}
                  templates={controller.store.templates}
                  categories={controller.store.categories}
                  decisions={controller.decisions}
                  incomeDecisions={controller.incomeDecisions}
                  language={controller.language}
                  onDecisionChange={controller.updateDecision}
                  onExpenseChange={controller.updateExpenseDraft}
                  onIncomeDecisionChange={controller.updateIncomeDecision}
                  onIncomeChange={controller.updateIncomeDraft}
                  onSalaryChange={controller.updateSalaryDraft}
                />
              </>
            )}
          </>
        ) : controller.step === "applied" ? (
          <BankImportAppliedState language={controller.language} />
        ) : (
          <div className="app-import-empty mt-4 p-5 text-center">
            <p className="text-sm font-semibold text-[var(--app-text-muted)]">
              {t("settings.bankImportEmpty", controller.language)}
            </p>
          </div>
        )}
      </div>

      {controller.analysis ? (
        <>
          <BankImportBackToTopButton language={controller.language} />
          <footer className="app-import-action-footer">
            <div className="app-import-action-footer-inner">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                size="lg"
                onClick={
                  controller.step === "confirm"
                    ? controller.applyImport
                    : controller.continueImportReview
                }
                leadingIcon={
                  controller.step === "confirm" ? (
                    <Check size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
              >
                {controller.step === "confirm"
                  ? t("settings.bankImportConfirm", controller.language)
                  : t("settings.bankImportNext", controller.language)}
              </Button>
            </div>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function BankImportBackToTopButton({ language }: { language: AppLanguage }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setVisible(window.scrollY > 520);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <button
      type="button"
      className="app-import-back-top"
      data-visible={visible ? "true" : "false"}
      aria-label={t("settings.bankImportBackToTop", language)}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={18} />
    </button>
  );
}

function BankImportModeTabs({
  activeMode,
  expenseCount,
  incomeCount,
  reviewedModes,
  language,
  onChange,
}: {
  activeMode: BankImportMode;
  expenseCount: number;
  incomeCount: number;
  reviewedModes: Record<BankImportMode, boolean>;
  language: AppLanguage;
  onChange: (mode: BankImportMode) => void;
}) {
  const options: Array<{
    mode: BankImportMode;
    label: string;
    count: number;
  }> = [
    {
      mode: "expenses",
      label: t("settings.bankImportExpensesTab", language),
      count: expenseCount,
    },
    {
      mode: "income",
      label: t("settings.bankImportIncomeTab", language),
      count: incomeCount,
    },
  ];

  return (
    <div className="app-import-mode-tabs mt-4" role="tablist" aria-label="Tipo de movimiento">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="tab"
          aria-selected={activeMode === option.mode}
          aria-label={`${option.label} ${option.count}${
            option.count > 0 && !reviewedModes[option.mode]
              ? `, ${t("settings.bankImportPendingReview", language)}`
              : ""
          }`}
          className="app-import-mode-tab"
          data-selected={activeMode === option.mode ? "true" : "false"}
          data-reviewed={reviewedModes[option.mode] ? "true" : "false"}
          onClick={() => onChange(option.mode)}
        >
          <span>{option.label}</span>
          <strong>{option.count}</strong>
        </button>
      ))}
    </div>
  );
}

function BankImportConfirmPanel({
  summary,
  language,
  onBack,
}: {
  summary: BankImportSelectionSummary;
  language: AppLanguage;
  onBack: () => void;
}) {
  return (
    <section className="app-import-confirm mt-5">
      <div className="app-import-confirm-header">
        <span className="app-import-confirm-icon" aria-hidden="true">
          <Check size={18} />
        </span>
        <div className="min-w-0">
          <h2>{t("settings.bankImportConfirmTitle", language)}</h2>
          <p>{t("settings.bankImportConfirmBody", language)}</p>
        </div>
      </div>

      <div className="app-import-confirm-list">
        <BankImportConfirmGroup
          title={t("settings.bankImportExpensesTab", language)}
          group={summary.expenses}
          language={language}
        />
        <BankImportConfirmGroup
          title={t("settings.bankImportIncomeTab", language)}
          group={summary.income}
          language={language}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start px-0"
        leadingIcon={<ArrowLeft size={16} />}
        onClick={onBack}
      >
        {t("common.back", language)}
      </Button>
    </section>
  );
}

function BankImportConfirmGroup({
  title,
  group,
  language,
}: {
  title: string;
  group: BankImportSelectionSummary["expenses"];
  language: AppLanguage;
}) {
  return (
    <div className="app-import-confirm-group">
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>{t("settings.bankImportSelected", language)}</dt>
          <dd>{group.selected}</dd>
        </div>
        <div>
          <dt>{t("settings.bankImportIgnored", language)}</dt>
          <dd>{group.ignored}</dd>
        </div>
      </dl>
    </div>
  );
}

function BankImportAppliedState({ language }: { language: AppLanguage }) {
  return (
    <section className="app-import-applied mt-4">
      <span className="app-import-confirm-icon" aria-hidden="true">
        <Check size={18} />
      </span>
      <h2>{t("settings.bankImportAppliedTitle", language)}</h2>
      <p>{t("settings.bankImportApplied", language)}</p>
    </section>
  );
}
