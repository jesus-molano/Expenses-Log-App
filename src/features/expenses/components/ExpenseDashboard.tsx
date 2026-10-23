"use client";

import { useMemo, useRef, useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import type { ExpenseOccurrence } from "@/domain/types";
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
import { QuickCaptureReview } from "@/features/expenses/components/QuickCaptureReview";
import { RecurringOverviewButton } from "@/features/expenses/components/RecurringOverviewButton";
import { RecurringOverviewSheet } from "@/features/expenses/components/RecurringOverviewSheet";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useExpenseCaptureFlow } from "@/features/expenses/hooks/use-expense-capture-flow";
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
    addExpenses,
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
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  const showCloseCard =
    month.suggestAdvance && month.viewMonthId === month.activeMonthId;

  // La tarjeta, el aviso o el chip que se acaba de usar desaparece: el foco
  // pasa al título del mes para que el teclado y el lector no se pierdan.
  function focusMonthHeading() {
    window.requestAnimationFrame(() => monthHeadingRef.current?.focus());
  }
  const categoryNames = useMemo(
    () => store.categories.map((category) => category.name),
    [store.categories],
  );
  const quickParser = useQuickExpenseParser({ language, categories: categoryNames });
  const capture = useExpenseCaptureFlow({
    parser: quickParser,
    initialFormOpen: initialNewExpense,
    addExpense,
    addExpenses,
  });
  const chrome = useScrollChrome();
  const runViewTransition = useViewTransitionAction();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [hiddenReminderId, setHiddenReminderId] = useState<string | null>(null);
  const lastChanceReminder = buildLastChanceReminders(store, now).find(
    (reminder) => reminder.occurrence.id !== hiddenReminderId,
  );

  function advanceMonth() {
    month.advance();
    focusMonthHeading();
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
        focusMonthHeading();
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
          onReset={() => {
            month.reset();
            focusMonthHeading();
          }}
          onReopen={() => {
            month.reopen();
            focusMonthHeading();
          }}
          headingRef={monthHeadingRef}
        />
        {showCloseCard ? (
          <MonthCloseCard
            status={month.closeStatus}
            nextMonthId={month.nextMonthId}
            hasPayday={month.payday !== null}
            language={language}
            onAdvance={advanceMonth}
            onDismiss={() => {
              month.dismiss();
              focusMonthHeading();
            }}
          />
        ) : null}
      </div>

      <ExpenseList
        sections={filters.timelineSections}
        categories={store.categories}
        today={filters.today}
        monthId={month.viewMonthId}
        openMonthId={month.calendarMonthId}
        autoScroll={!showCloseCard}
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
        visible={capture.isIdle}
        onClick={capture.openCapture}
      />

      <QuickCapture
        open={capture.captureOpen}
        value={quickParser.quickText}
        statusLabel={quickParser.statusLabel}
        statusTone={quickParser.statusTone}
        isParsing={quickParser.status === "loading"}
        needsLogin={quickParser.needsLogin}
        language={language}
        onClose={capture.closeCapture}
        onValueChange={quickParser.setQuickText}
        onAnalyze={capture.analyze}
        onCancel={quickParser.cancel}
        onManualAdd={capture.openManualForm}
      />

      {capture.reviewItems ? (
        <QuickCaptureReview
          items={capture.reviewItems}
          existingNames={store.templates.map((template) => template.name)}
          language={language}
          onEdit={capture.editReviewItem}
          onSave={capture.saveReviewed}
          onClose={capture.closeReview}
        />
      ) : null}

      <ExpenseFormSheet
        key={capture.formKey}
        open={capture.formOpen}
        draft={capture.draft}
        review={capture.draftReview}
        language={language}
        onClose={capture.closeForm}
        onSave={capture.saveForm}
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
          onPause={actionToast.pause}
          onResume={actionToast.resume}
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


