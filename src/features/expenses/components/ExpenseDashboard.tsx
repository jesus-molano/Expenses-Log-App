"use client";

import { useState } from "react";
import type { CreateExpenseOptions, DraftExpense } from "@/domain/types";
import { createEmptyDraft } from "@/features/expenses/lib/dashboard-config";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { ExpenseFormSheet } from "@/features/expenses/components/ExpenseFormSheet";
import { ExpenseList } from "@/features/expenses/components/ExpenseList";
import { QuickCapture } from "@/features/expenses/components/QuickCapture";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useViewTransitionAction } from "@/features/expenses/hooks/use-view-transition-action";
import { t } from "@/shared/i18n";

type DashboardProps = {
  initialNewExpense?: boolean;
};

export function ExpenseDashboard({
  initialNewExpense = false,
}: DashboardProps) {
  const {
    store,
    addExpense,
    togglePaid,
    moveOccurrence,
    moveOccurrenceSeries,
  } = useExpenseStore();
  const language = store.preferences?.language ?? "es";
  const filters = useExpenseFilters(store, language);
  const quickParser = useQuickExpenseParser();
  const chrome = useScrollChrome();
  const runViewTransition = useViewTransitionAction();
  const [draft, setDraft] = useState<DraftExpense>(() => createEmptyDraft());
  const [sheetOpen, setSheetOpen] = useState(initialNewExpense);

  function openEmptySheet() {
    setDraft(createEmptyDraft());
    setSheetOpen(true);
  }

  async function analyzeQuickText() {
    const parsedDraft = await quickParser.parse();
    if (!parsedDraft) return;

    setDraft(parsedDraft);
    setSheetOpen(true);
  }

  function saveDraft(nextDraft: DraftExpense, options?: CreateExpenseOptions) {
    addExpense(nextDraft, options);
    setDraft(createEmptyDraft());
    setSheetOpen(false);
  }

  return (
    <DashboardShell
      headlineLabel={filters.pendingTotalLabel}
      headlineTitle={t("common.due", language)}
      activeTab="expenses"
      language={language}
    >
      <ExpenseList
        sections={filters.timelineSections}
        categories={store.categories}
        today={filters.today}
        language={language}
        onTogglePaid={(occurrence) => runViewTransition(() => togglePaid(occurrence))}
        onMoveOccurrence={(occurrence, dueDate, sortOrder) =>
          runViewTransition(() => moveOccurrence(occurrence, dueDate, sortOrder))
        }
        onMoveOccurrenceSeries={(occurrence, dueDate) =>
          runViewTransition(() => moveOccurrenceSeries(occurrence, dueDate))
        }
      />

      <QuickCapture
        value={quickParser.quickText}
        statusLabel={quickParser.statusLabel}
        isParsing={quickParser.status === "loading"}
        visible={chrome.showBottomBar}
        language={language}
        onValueChange={(value) => {
          quickParser.setQuickText(value);
        }}
        onAnalyze={analyzeQuickText}
        onManualAdd={openEmptySheet}
      />

      <ExpenseFormSheet
        key={`${draft.name}:${draft.description}:${draft.amount}:${draft.categoryName}:${draft.dueDay}:${draft.tags.join(",")}:${sheetOpen}`}
        open={sheetOpen}
        draft={draft}
        language={language}
        onClose={() => setSheetOpen(false)}
        onSave={saveDraft}
      />
    </DashboardShell>
  );
}


