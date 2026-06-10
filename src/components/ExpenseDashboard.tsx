"use client";

import { useState } from "react";
import { formatShortDate } from "@/domain/calendar";
import type { DraftExpense } from "@/domain/types";
import { createEmptyDraft } from "@/features/expenses/lib/dashboard-config";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { ExpenseFormSheet } from "@/features/expenses/components/ExpenseFormSheet";
import { ExpenseList } from "@/features/expenses/components/ExpenseList";
import { QuickCapture } from "@/features/expenses/components/QuickCapture";
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

  const nextLabel = filters.nextOccurrence
    ? `${filters.nextOccurrence.template.name} - ${formatShortDate(
        filters.nextOccurrence.estimatedChargeDate,
      )}`
    : "Sin cobros pendientes";

  return (
    <DashboardShell
      pendingTotalLabel={filters.pendingTotalLabel}
      nextLabel={nextLabel}
      userEmail={userEmail}
      isCloudReady={isCloudReady}
      onNewExpense={openEmptySheet}
    >
      <ExpenseList
        sections={filters.timelineSections}
        categories={store.categories}
        today={filters.today}
        onTogglePaid={togglePaid}
      />

      <QuickCapture
        value={quickParser.quickText || filters.query}
        statusLabel={quickParser.statusLabel}
        isParsing={quickParser.status === "loading"}
        onValueChange={(value) => {
          quickParser.setQuickText(value);
          filters.setQuery(value);
        }}
        onAnalyze={analyzeQuickText}
        onManualAdd={openEmptySheet}
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
