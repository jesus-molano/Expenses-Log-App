"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import { addMonthId } from "@/domain/budget-month";
import { periodRange } from "@/domain/budget-cycle";
import type { ExpenseOccurrence } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { ExpenseFormSheet } from "@/features/expenses/components/ExpenseFormSheet";
import { ExpenseList } from "@/features/expenses/components/ExpenseList";
import { LastChanceReminderToast } from "@/features/expenses/components/LastChanceReminderToast";
import { MonthBar } from "@/features/expenses/components/MonthBar";
import { MonthCloseCard } from "@/features/expenses/components/MonthCloseCard";
import { NextMonthPreview } from "@/features/expenses/components/NextMonthPreview";
import { OccurrenceActionSheet } from "@/features/expenses/components/OccurrenceActionSheet";
import { MonthCloseSheet } from "@/features/expenses/components/month-close/MonthCloseSheet";
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
import { useMonthCloseSheet } from "@/features/expenses/hooks/use-month-close-sheet";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useViewTransitionAction } from "@/features/expenses/hooks/use-view-transition-action";
import { buildLastChanceReminders } from "@/features/expenses/lib/last-chance-reminders";
import { canMoveOccurrence } from "@/features/expenses/lib/dnd-move-policy";
import {
  capitalize,
  formatMonthName,
  periodRangeLabel,
} from "@/features/expenses/lib/month-view";
import {
  markNewExpenseIntentHandled,
  readNewExpenseIntent,
} from "@/features/expenses/lib/new-expense-intent";
import { MonthSummarySheet } from "@/features/plan/components/MonthSummarySheet";
import { useMonthSummary } from "@/features/plan/hooks/use-month-summary";
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
    skipOccurrence,
    restoreOccurrence,
    payOccurrence,
    markOccurrencesPaid,
    moveOccurrence,
    updateMonthlySavingsContribution,
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
  const monthSummary = useMonthSummary({
    store,
    today: filters.today,
    language,
  });
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  const closeCardVariant = month.suggestAdvance
    ? "settled"
    : month.suggestCloseWithLeftovers
      ? "leftovers"
      : null;
  const showCloseCard =
    closeCardVariant !== null && month.viewMonthId === month.activeMonthId;
  const closeSheet = useMonthCloseSheet({
    store,
    monthId: month.calendarMonthId,
    today: month.today,
    language,
    commands: {
      togglePaid,
      skipOccurrence,
      restoreOccurrence,
      moveOccurrence,
      markOccurrencesPaid,
      updateMonthlySavingsContribution,
    },
    // Si mientras estaba abierta empezó otro mes, no se cierra el nuevo.
    onStart: (closedMonthId) => {
      if (closedMonthId === month.calendarMonthId) advanceMonth();
    },
  });

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
  // `?mode=voice` (atajo "Añadir por voz") se lee en el cliente para que la
  // página siga siendo estática y precacheada.
  const [newExpenseIntent] = useState(() => readNewExpenseIntent(initialNewExpense));
  // Se marca antes de que las hojas añadan su entrada al historial (que lo
  // hacen en efectos normales).
  useLayoutEffect(() => {
    if (newExpenseIntent) markNewExpenseIntentHandled();
  }, [newExpenseIntent]);
  const capture = useExpenseCaptureFlow({
    parser: quickParser,
    language,
    initialFormOpen: newExpenseIntent === "form",
    initialCaptureOpen: newExpenseIntent === "voice",
    addExpense,
    addExpenses,
  });
  const chrome = useScrollChrome();
  const runViewTransition = useViewTransitionAction();
  const router = useRouter();
  const [recurringOpen, setRecurringOpen] = useState(false);
  // Cobro tocado en la lista: abre sus acciones.
  const [selectedOccurrence, setSelectedOccurrence] = useState<ExpenseOccurrence | null>(null);
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
    payWithMonthCheck(occurrence, () => togglePaid(occurrence));
  }

  // Si el pago deja el mes al día, se ofrece pasar al siguiente.
  function payWithMonthCheck(occurrence: ExpenseOccurrence, pay: () => void) {
    const settles = month.settlesMonth(occurrence);
    runViewTransition(pay);
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

  function payOtherAmount(occurrence: ExpenseOccurrence, amount: number) {
    payWithMonthCheck(occurrence, () => payOccurrence(occurrence, amount));
  }

  function skipWithUndo(occurrence: ExpenseOccurrence) {
    runViewTransition(() => skipOccurrence(occurrence));
    actionToast.show({
      message: t("expenses.occurrenceSkipped", language).replace(
        "{name}",
        occurrence.template.name,
      ),
      actionLabel: t("common.undo", language),
      onAction: () => {
        runViewTransition(() => restoreOccurrence(occurrence));
        actionToast.dismiss();
      },
    });
  }

  // No se mueve a un mes ya cerrado. Con el ciclo anclado al cobro el mes
  // abierto empieza el día de cobro, pero nunca antes del mes natural en curso
  // (los anteriores ya son historial).
  const openMonthId =
    month.activeMonthId > month.calendarMonthId ? month.activeMonthId : month.calendarMonthId;
  const openMonthStart = [
    periodRange(openMonthId, month.cycle).start,
    `${filters.today.slice(0, 7)}-01`,
  ].sort()[1];
  // Hasta el final del mes que se puede ver después del abierto.
  const lastMoveDate = periodRange(addMonthId(openMonthId, 1), month.cycle).end;

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
          rangeLabel={periodRangeLabel(month.viewMonthId, month.cycle, language)}
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
            variant={closeCardVariant ?? "settled"}
            onAdvance={advanceMonth}
            onReview={() => closeSheet.open(month.closeStatus.leftovers)}
            onDismiss={() => {
              month.dismiss();
              focusMonthHeading();
            }}
            onOpenSummary={() => monthSummary.open(month.calendarMonthId)}
          />
        ) : null}
      </div>

      <ExpenseList
        sections={filters.timelineSections}
        categories={store.categories}
        today={filters.today}
        monthId={month.viewMonthId}
        openMonthId={filters.today.slice(0, 7)}
        dropFloorDate={month.dropFloorDate}
        autoScroll={!showCloseCard}
        language={language}
        onTogglePaid={togglePaidWithMonthCheck}
        onOpenOccurrence={setSelectedOccurrence}
        onMoveOccurrenceOnly={(occurrence, dueDate, sortOrder) =>
          runViewTransition(() => moveOccurrenceOnly(occurrence, dueDate, sortOrder))
        }
        onMoveOccurrenceSeries={(occurrence, dueDate) =>
          runViewTransition(() => moveOccurrenceSeries(occurrence, dueDate))
        }
      />

      {filters.nextMonthPreview && month.viewMonthId === month.activeMonthId && month.canBrowseForward ? (
        <NextMonthPreview
          {...filters.nextMonthPreview}
          language={language}
          onShow={() => {
            month.browse(1);
            focusMonthHeading();
          }}
        />
      ) : null}

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

      {capture.reviewItems ? (
        <QuickCaptureReview
          items={capture.reviewItems}
          excludedIds={capture.excludedIds}
          initialStatus={capture.reviewStatus}
          previousCharges={capture.reviewPreviousCharges}
          notice={capture.notice}
          existingNames={store.templates.map((template) => template.name)}
          language={language}
          onToggle={capture.toggleReviewItem}
          onInitialStatusChange={capture.setReviewStatus}
          onPreviousChargesChange={capture.setReviewPreviousCharges}
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
        onClose={capture.closeForm}
        onSave={capture.saveForm}
      />

      {selectedOccurrence ? (
        <OccurrenceActionSheet
          key={selectedOccurrence.id}
          occurrence={selectedOccurrence}
          minMoveDate={openMonthStart}
          maxMoveDate={lastMoveDate}
          canMove={canMoveOccurrence(selectedOccurrence, openMonthId)}
          language={language}
          onClose={() => setSelectedOccurrence(null)}
          onTogglePaid={togglePaidWithMonthCheck}
          onPayAmount={payOtherAmount}
          // Mover desde aquí solo toca este cobro (override), nunca la serie.
          onMove={(occurrence, dueDate) =>
            runViewTransition(() => moveOccurrence(occurrence, dueDate))
          }
          onSkip={skipWithUndo}
          // replace: la entrada de la hoja en el historial pasa a ser la del
          // detalle, y Atrás desde el detalle vuelve al listado.
          onEditSeries={(occurrence) => router.replace(`/expenses/${occurrence.template.id}`)}
        />
      ) : null}

      {closeSheet.isOpen && closeSheet.plan ? (
        <MonthCloseSheet
          monthId={closeSheet.monthId}
          nextMonthId={addMonthId(closeSheet.monthId, 1)}
          plan={closeSheet.plan}
          rows={closeSheet.rows}
          categories={store.categories}
          today={month.today}
          language={language}
          savingsText={closeSheet.savingsText}
          savingsTarget={closeSheet.savingsTarget}
          savingsInvalid={closeSheet.savingsInvalid}
          onSavingsChange={closeSheet.setSavingsText}
          onClose={closeSheet.close}
          onPay={closeSheet.pay}
          onSkip={closeSheet.skip}
          onMove={closeSheet.move}
          onUndo={closeSheet.undo}
          onPayAll={closeSheet.payAll}
          onStart={closeSheet.start}
        />
      ) : null}

      {monthSummary.summary ? (
        <MonthSummarySheet
          summary={monthSummary.summary}
          language={language}
          periodLabel={periodRangeLabel(monthSummary.summary.monthId, month.cycle, language)}
          onClose={monthSummary.close}
        />
      ) : null}

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


