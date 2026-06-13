"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUp, Check, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { BankImportFilePanel } from "./BankImportFilePanel";
import { BankImportReviewSections } from "./BankImportReviewSections";
import { BankImportSummary } from "./BankImportSummary";
import type { BankImportMode } from "../hooks/use-bank-import-controller";
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

            <BankImportModeTabs
              activeMode={controller.activeMode}
              expenseCount={controller.analysis.candidates.length}
              incomeCount={controller.analysis.incomeCandidates.length}
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
                onClick={controller.applyImport}
                leadingIcon={<Check size={18} />}
              >
                {t("settings.bankImportConfirm", controller.language)}
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
  language,
  onChange,
}: {
  activeMode: BankImportMode;
  expenseCount: number;
  incomeCount: number;
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
          className="app-import-mode-tab"
          data-selected={activeMode === option.mode ? "true" : "false"}
          onClick={() => onChange(option.mode)}
        >
          <span>{option.label}</span>
          <strong>{option.count}</strong>
        </button>
      ))}
    </div>
  );
}
