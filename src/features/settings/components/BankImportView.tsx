"use client";

import Link from "next/link";
import { ArrowLeft, Check, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import { BankImportCandidateCard } from "./BankImportCandidateCard";
import { BankImportFilePanel } from "./BankImportFilePanel";
import { BankImportSummary } from "./BankImportSummary";
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
              movementCount={controller.analysis.movements.length}
              language={controller.language}
            />

            <div className="mt-5 grid gap-6">
              {controller.sections.map((section) => (
                <section key={section.kind} className="app-import-section grid gap-2">
                  <div className="app-import-section-header">
                    <h2 className="app-import-section-title">
                      {section.title}
                    </h2>
                    <span className="app-import-section-count">
                      {section.candidates.length}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {section.candidates.map((candidate) => (
                      <BankImportCandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        templates={controller.store.templates}
                        categories={controller.store.categories}
                        decision={controller.decisions[candidate.id]}
                        language={controller.language}
                        onDecisionChange={(patch) =>
                          controller.updateDecision(candidate.id, patch)
                        }
                        onExpenseChange={(patch) =>
                          controller.updateExpenseDraft(candidate.id, patch)
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

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
      ) : null}
    </main>
  );
}
