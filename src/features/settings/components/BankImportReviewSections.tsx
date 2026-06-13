"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { BankImportIncomeDraft } from "@/domain/bank-import";
import type { AppLanguage, ExpenseCategory, ExpenseTemplate } from "@/domain/types";
import type {
  BankImportCandidateDecision,
  BankImportIncomeCandidateDecision,
  BankImportIncomeCandidateDecisionPatch,
  BankImportIncomeSection,
  BankImportSection,
} from "../hooks/use-bank-import-controller";
import { BankImportCandidateCard } from "./BankImportCandidateCard";
import { BankImportIncomeCandidateCard } from "./BankImportIncomeCandidateCard";

type BankImportReviewSectionsProps = {
  sections: BankImportSection[];
  incomeSections: BankImportIncomeSection[];
  mode: "expenses" | "income";
  templates: ExpenseTemplate[];
  categories: ExpenseCategory[];
  decisions: Record<string, BankImportCandidateDecision>;
  incomeDecisions: Record<string, BankImportIncomeCandidateDecision>;
  language: AppLanguage;
  onDecisionChange: (
    candidateId: string,
    patch: Partial<BankImportCandidateDecision>,
  ) => void;
  onExpenseChange: (
    candidateId: string,
    patch: Partial<BankImportCandidateDecision["expense"]>,
  ) => void;
  onIncomeDecisionChange: (
    candidateId: string,
    patch: BankImportIncomeCandidateDecisionPatch,
  ) => void;
  onIncomeChange: (candidateId: string, patch: Partial<BankImportIncomeDraft>) => void;
  onSalaryChange: (
    candidateId: string,
    patch: Partial<BankImportIncomeCandidateDecision["salary"]>,
  ) => void;
};

export function BankImportReviewSections({
  sections,
  incomeSections,
  mode,
  templates,
  categories,
  decisions,
  incomeDecisions,
  language,
  onDecisionChange,
  onExpenseChange,
  onIncomeDecisionChange,
  onIncomeChange,
  onSalaryChange,
}: BankImportReviewSectionsProps) {
  return (
    <div className="mt-5 grid gap-6">
      {mode === "expenses"
        ? sections.map((section) => (
            <BankImportSectionFrame
              key={section.kind}
              title={section.title}
              count={section.candidates.length}
            >
              {section.candidates.map((candidate) => (
                <BankImportCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  templates={templates}
                  categories={categories}
                  decision={decisions[candidate.id]}
                  language={language}
                  onDecisionChange={(patch) => onDecisionChange(candidate.id, patch)}
                  onExpenseChange={(patch) => onExpenseChange(candidate.id, patch)}
                />
              ))}
            </BankImportSectionFrame>
          ))
        : incomeSections.map((section) => (
            <BankImportSectionFrame
              key={section.kind}
              title={section.title}
              count={section.candidates.length}
            >
              {section.candidates.map((candidate) => (
                <BankImportIncomeCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  decision={incomeDecisions[candidate.id]}
                  language={language}
                  onDecisionChange={(patch) =>
                    onIncomeDecisionChange(candidate.id, patch)
                  }
                  onIncomeChange={(patch) => onIncomeChange(candidate.id, patch)}
                  onSalaryChange={(patch) => onSalaryChange(candidate.id, patch)}
                />
              ))}
            </BankImportSectionFrame>
          ))}
    </div>
  );
}

function BankImportSectionFrame({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    function updateHeight() {
      setContentHeight(content?.scrollHeight ?? 0);
    }

    updateHeight();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [count]);

  return (
    <section className="app-import-section grid gap-2" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="app-import-section-header"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <h2 className="app-import-section-title">{title}</h2>
        <span className="app-import-section-count">{count}</span>
        <span className="app-import-section-toggle" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </button>

      <div
        className="app-import-section-collapse"
        aria-hidden={!open}
        style={{ height: open ? `${contentHeight}px` : "0px" }}
      >
        <div ref={contentRef} className="app-import-section-list grid gap-2">
          {children}
        </div>
      </div>
    </section>
  );
}
