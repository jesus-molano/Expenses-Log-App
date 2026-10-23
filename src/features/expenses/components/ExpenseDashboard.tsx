"use client";

import { useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import type {
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
} from "@/domain/types";
import { createEmptyDraft } from "@/features/expenses/lib/dashboard-config";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { ExpenseFormSheet } from "@/features/expenses/components/ExpenseFormSheet";
import { ExpenseList } from "@/features/expenses/components/ExpenseList";
import { LastChanceReminderToast } from "@/features/expenses/components/LastChanceReminderToast";
import { MonthBar } from "@/features/expenses/components/MonthBar";
import { MonthCloseCard } from "@/features/expenses/components/MonthCloseCard";
import {
  AddExpenseButton,
  QuickCapture,
} from "@/features/expenses/components/QuickCapture";
import { RecurringOverviewButton } from "@/features/expenses/components/RecurringOverviewButton";
import { RecurringOverviewSheet } from "@/features/expenses/components/RecurringOverviewSheet";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useViewTransitionAction } from "@/features/expenses/hooks/use-view-transition-action";
import { buildLastChanceReminders } from "@/features/expenses/lib/last-chance-reminders";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
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
    dismissLastChanceReminder,
    moveOccurrenceOnly,
    moveOccurrenceSeries,
    closeMonth,
    reopenMonth,
  } = useExpenseStore();
  const language = store.preferences?.language ?? "es";
  const now = useCurrentDate();
  const month = useActiveMonth({ store, language, now, closeMonth, reopenMonth });
  const filters = useExpenseFilters(store, language, now, month.viewMonthId);
  const actionToast = useActionToast();
  const quickParser = useQuickExpenseParser(language);
  const chrome = useScrollChrome();
  const runViewTransition = useViewTransitionAction();
  const [draft, setDraft] = useState<DraftExpense>(() => createEmptyDraft());
  const [sheetOpen, setSheetOpen] = useState(initialNewExpense);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [hiddenReminderId, setHiddenReminderId] = useState<string | null>(null);
  const lastChanceReminder = buildLastChanceReminders(store, now).find(
    (reminder) => reminder.occurrence.id !== hiddenReminderId,
  );

  function openEmptySheet() {
    setDraft(createEmptyDraft());
    setAddSheetOpen(false);
    setSheetOpen(true);
  }

  async function analyzeQuickText() {
    const parsedDraft = await quickParser.parse();
    if (!parsedDraft) return;

    setDraft(parsedDraft);
    setAddSheetOpen(false);
    setSheetOpen(true);
  }

  function advanceMonth() {
    month.advance();
    actionToast.show({
      message: capitalize(
        t("expenses.monthActive", language).replace(
          "{month}",
          formatMonthName(month.nextMonthId, language),
        ),
      ),
      actionLabel: t("common.undo", language),
      onAction: () => {
        month.reopen();
        actionToast.dismiss();
      },
    });
  }

  function togglePaidWithMonthCheck(occurrence: ExpenseOccurrence) {
    const settles = month.settlesMonth(occurrence);
    runViewTransition(() => togglePaid(occurrence));
    if (!settles) return;
    actionToast.show({
      message: capitalize(
        t("expenses.monthSettledTitle", language).replace(
          "{month}",
          formatMonthName(month.calendarMonthId, language),
        ),
      ),
      actionLabel: capitalize(
        t("expenses.advanceToMonth", language).replace(
          "{month}",
          formatMonthName(month.nextMonthId, language),
        ),
      ),
      onAction: advanceMonth,
    });
  }

  function saveDraft(nextDraft: DraftExpense, options?: CreateExpenseOptions) {
    addExpense(nextDraft, options);
    setDraft(createEmptyDraft());
    setSheetOpen(false);
  }

  return (
    <DashboardShell
      headlineLabel={filters.pendingTotalLabel}
      headlineTitle={`${t("common.due", language)} · ${formatMonthName(month.viewMonthId, language)}`}
      activeTab="expenses"
      language={language}
      panelChrome={chrome.panelChrome}
      headerAction={
        <RecurringOverviewButton
          language={language}
          onClick={() => setRecurringOpen(true)}
        />
      }
    >
      <div className="mb-5 grid gap-3">
        <MonthBar
          monthId={month.viewMonthId}
          activeMonthId={month.activeMonthId}
          calendarMonthId={month.calendarMonthId}
          language={language}
          canBrowseBack={month.canBrowseBack}
          canBrowseForward={month.canBrowseForward}
          onBrowse={month.browse}
          onReset={month.reset}
          onReopen={month.reopen}
        />
        {month.suggestAdvance && month.viewMonthId === month.activeMonthId ? (
          <MonthCloseCard
            status={month.closeStatus}
            nextMonthId={month.nextMonthId}
            hasPayday={month.payday !== null}
            language={language}
            onAdvance={advanceMonth}
            onDismiss={month.dismiss}
          />
        ) : null}
      </div>

      <ExpenseList
        sections={filters.timelineSections}
        categories={store.categories}
        today={filters.today}
        monthId={month.viewMonthId}
        language={language}
        onTogglePaid={togglePaidWithMonthCheck}
        onMoveOccurrenceOnly={(occurrence, dueDate, sortOrder) =>
          runViewTransition(() => moveOccurrenceOnly(occurrence, dueDate, sortOrder))
        }
        onMoveOccurrenceSeries={(occurrence, dueDate) =>
          runViewTransition(() => moveOccurrenceSeries(occurrence, dueDate))
        }
      />

      <AddExpenseButton
        language={language}
        visible={!addSheetOpen && !sheetOpen}
        onClick={() => setAddSheetOpen(true)}
      />

      <QuickCapture
        open={addSheetOpen}
        value={quickParser.quickText}
        statusLabel={quickParser.statusLabel}
        statusTone={quickParser.statusTone}
        isParsing={quickParser.status === "loading"}
        language={language}
        onClose={() => setAddSheetOpen(false)}
        onValueChange={(value) => {
          quickParser.setQuickText(value);
        }}
        onAnalyze={analyzeQuickText}
        onManualAdd={openEmptySheet}
      />

      <ExpenseFormSheet
        key={`${draft.name}:${draft.description}:${draft.amount}:${draft.categoryName}:${draft.dueDay}:${sheetOpen}`}
        open={sheetOpen}
        draft={draft}
        language={language}
        onClose={() => setSheetOpen(false)}
        onSave={saveDraft}
      />

      <RecurringOverviewSheet
        open={recurringOpen}
        items={filters.recurringOverviewItems}
        categories={store.categories}
        language={language}
        onClose={() => setRecurringOpen(false)}
      />

      {actionToast.toast ? (
        <ActionToast
          key={actionToast.toast.id}
          message={actionToast.toast.message}
          actionLabel={actionToast.toast.actionLabel}
          onAction={actionToast.toast.onAction}
        />
      ) : lastChanceReminder ? (
        <LastChanceReminderToast
          occurrence={lastChanceReminder.occurrence}
          daysUntilCharge={lastChanceReminder.daysUntilCharge}
          language={language}
          onDismiss={(occurrence) => {
            setHiddenReminderId(occurrence.id);
            dismissLastChanceReminder(occurrence);
          }}
        />
      ) : null}
    </DashboardShell>
  );
}


