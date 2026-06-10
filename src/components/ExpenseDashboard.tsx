"use client";

import { useState } from "react";
import type { DraftExpense } from "@/domain/types";
import { createEmptyDraft } from "@/features/expenses/lib/dashboard-config";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { ExpenseFormSheet } from "@/features/expenses/components/ExpenseFormSheet";
import { ExpenseList } from "@/features/expenses/components/ExpenseList";
import { QuickCapture } from "@/features/expenses/components/QuickCapture";
import { TagFilter } from "@/features/expenses/components/TagFilter";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useExpenseStore } from "@/features/expenses/hooks/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";

type DashboardProps = {
  initialNewExpense?: boolean;
  userEmail?: string | null;
  isCloudReady?: boolean;
};

export function ExpenseDashboard({
  initialNewExpense = false,
  userEmail = null,
  isCloudReady = false,
}: DashboardProps) {
  const { store, addExpense, togglePaid } = useExpenseStore();
  const filters = useExpenseFilters(store);
  const quickParser = useQuickExpenseParser();
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

  function saveDraft(nextDraft: DraftExpense) {
    addExpense(nextDraft);
    setDraft(createEmptyDraft());
    setSheetOpen(false);
  }

  return (
    <DashboardShell
      selectedList={filters.selectedList}
      pendingTotalLabel={filters.pendingTotalLabel}
      userEmail={userEmail}
      isCloudReady={isCloudReady}
      onSelectList={filters.setSelectedList}
      onNewExpense={openEmptySheet}
    >
      <QuickCapture
        query={filters.query}
        quickText={quickParser.quickText}
        statusLabel={quickParser.statusLabel}
        isParsing={quickParser.status === "loading"}
        onQueryChange={filters.setQuery}
        onQuickTextChange={quickParser.setQuickText}
        onAnalyze={analyzeQuickText}
      />

      <TagFilter
        tags={filters.tags}
        selectedTag={filters.selectedTag}
        onSelectTag={filters.setSelectedTag}
      />

      <ExpenseList
        selectedList={filters.selectedList}
        occurrences={filters.visibleOccurrences}
        categories={store.categories}
        today={filters.today}
        onTogglePaid={togglePaid}
      />

      <ExpenseFormSheet
        key={`${draft.name}:${draft.description}:${draft.amount}:${sheetOpen}`}
        open={sheetOpen}
        draft={draft}
        onClose={() => setSheetOpen(false)}
        onSave={saveDraft}
      />
    </DashboardShell>
  );
}
