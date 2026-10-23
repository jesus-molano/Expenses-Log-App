"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import type { ExpenseOccurrence } from "@/domain/types";
import { CaptureCommandReview } from "@/features/expenses/components/CaptureCommandReview";
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
import { OnboardingCard } from "@/features/expenses/components/onboarding/OnboardingCard";
import { CatalogButton } from "@/features/expenses/components/catalog/CatalogButton";
import { ExpenseCatalogSheet } from "@/features/expenses/components/catalog/ExpenseCatalogSheet";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useExpenseCaptureFlow } from "@/features/expenses/hooks/use-expense-capture-flow";
import { useExpenseCatalog } from "@/features/expenses/hooks/use-expense-catalog";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useOnboarding } from "@/features/expenses/hooks/use-onboarding";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useViewTransitionAction } from "@/features/expenses/hooks/use-view-transition-action";
import { buildLastChanceReminders } from "@/features/expenses/lib/last-chance-reminders";
import { buildQuickAddDraft } from "@/features/expenses/lib/onboarding";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import {
  markNewExpenseIntentHandled,
  readNewExpenseIntent,
} from "@/features/expenses/lib/new-expense-intent";
import { PlanSettingsSheet } from "@/features/plan/components/PlanSettingsSheet";
import { usePlanSettingsForm } from "@/features/plan/hooks/use-plan-settings-form";
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
    createCategory,
    updateMoneySettings,
    applyCaptureCommands,
    revertCaptureCommands,
    syncStatus,
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
  // Para que la IA entienda órdenes sobre los gastos existentes.
  const expenseNames = useMemo(
    () => store.templates.filter((template) => template.active).map((template) => template.name),
    [store.templates],
  );
  const quickParser = useQuickExpenseParser({
    language,
    categories: categoryNames,
    expenseNames,
  });
  // `?mode=voice` (atajo "Añadir por voz") se lee en el cliente para que la
  // página siga siendo estática y precacheada.
  const [newExpenseIntent] = useState(() => readNewExpenseIntent(initialNewExpense));
  // Se marca antes de que las hojas añadan su entrada al historial (que lo
  // hacen en efectos normales).
  useLayoutEffect(() => {
    if (newExpenseIntent) markNewExpenseIntentHandled();
  }, [newExpenseIntent]);
  const onboarding = useOnboarding({
    store,
    monthId: month.activeMonthId,
    syncing: syncStatus === "syncing",
  });
  // Sueldo y día de cobro desde la guía, con la misma hoja que Plan.
  const salaryForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    savingsMonthId: month.activeMonthId,
    onSave: updateMoneySettings,
  });
  // El primer gasto añadido con la guía a la vista la mantiene hasta
  // completarla u ocultarla.
  function trackFirstExpense() {
    if (store.templates.length === 0 && onboarding.visible) onboarding.markStarted();
  }
  const capture = useExpenseCaptureFlow({
    parser: quickParser,
    language,
    initialFormOpen: newExpenseIntent === "form",
    initialCaptureOpen: newExpenseIntent === "voice",
    addExpense: (draft, options) => {
      trackFirstExpense();
      addExpense(draft, options);
    },
    addExpenses: (drafts, options) => {
      trackFirstExpense();
      addExpenses(drafts, options);
    },
  });
  const chrome = useScrollChrome();
  const runViewTransition = useViewTransitionAction();
  const catalog = useExpenseCatalog(store, filters.today, language);
  const [catalogOpen, setCatalogOpen] = useState(false);
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

  function applyCommands(confirmed: Parameters<typeof applyCaptureCommands>[0]) {
    const changes = applyCaptureCommands(confirmed);
    capture.finishCommands();
    if (!changes.length) return;
    actionToast.show({
      message:
        changes.length === 1
          ? t("captureCommands.appliedOne", language)
          : t("captureCommands.applied", language).replace("{count}", String(changes.length)),
      actionLabel: t("common.undo", language),
      onAction: () => {
        revertCaptureCommands(changes);
        actionToast.dismiss();
      },
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
        <CatalogButton
          language={language}
          attentionCount={catalog.endingCommitments}
          onClick={() => setCatalogOpen(true)}
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
        {onboarding.visible ? (
          <OnboardingCard
            checklist={onboarding.checklist}
            quickAdds={onboarding.quickAdds}
            canPromptInstall={onboarding.canPromptInstall}
            appleMobile={onboarding.appleMobile}
            language={language}
            onQuickAdd={(preset) =>
              capture.openDraftForm(buildQuickAddDraft(preset, language, now))
            }
            onAddExpense={capture.openCapture}
            onConfigureSalary={salaryForm.openSettings}
            onInstall={() => void onboarding.promptInstall()}
            onDismiss={() => {
              onboarding.dismiss();
              focusMonthHeading();
            }}
          />
        ) : null}
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
        autoScroll={!showCloseCard && !onboarding.visible}
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
        dictation={capture.dictation}
        language={language}
        onClose={capture.closeCapture}
        onValueChange={quickParser.setQuickText}
        onAnalyze={capture.analyze}
        onCancel={capture.cancelAnalysis}
        onManualAdd={capture.openManualForm}
      />

      {capture.commandReview ? (
        <CaptureCommandReview
          key={capture.commandReview.id}
          commands={capture.commandReview.commands}
          pendingDrafts={capture.commandReview.drafts.length}
          store={store}
          today={filters.today}
          monthId={month.viewMonthId}
          notice={capture.notice}
          language={language}
          onApply={applyCommands}
          onClose={capture.finishCommands}
        />
      ) : null}

      {capture.reviewItems ? (
        <QuickCaptureReview
          items={capture.reviewItems}
          excludedIds={capture.excludedIds}
          initialStatus={capture.reviewStatus}
          notice={capture.notice}
          existingNames={store.templates.map((template) => template.name)}
          language={language}
          onToggle={capture.toggleReviewItem}
          onInitialStatusChange={capture.setReviewStatus}
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
        notice={capture.notice}
        language={language}
        categories={store.categories}
        onCreateCategory={createCategory}
        onClose={capture.closeForm}
        onSave={capture.saveForm}
      />

      {salaryForm.settingsOpen ? (
        <PlanSettingsSheet
          language={language}
          salaryAmount={salaryForm.salaryAmount}
          salaryDay={salaryForm.salaryDay}
          savingsTarget={salaryForm.savingsTarget}
          dayPickerOpen={salaryForm.dayPickerOpen}
          onSalaryAmountChange={salaryForm.setSalaryAmount}
          onSalaryDayChange={salaryForm.setSalaryDay}
          onSavingsTargetChange={salaryForm.setSavingsTarget}
          onDayPickerOpenChange={salaryForm.setDayPickerOpen}
          onClose={salaryForm.closeSettings}
          onSubmit={salaryForm.submitSettings}
        />
      ) : null}

      {catalogOpen ? (
        <ExpenseCatalogSheet
          items={catalog.items}
          categories={store.categories}
          language={language}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}

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


