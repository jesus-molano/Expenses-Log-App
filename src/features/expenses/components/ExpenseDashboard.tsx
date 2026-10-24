"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import { suggestedPaidAmount } from "@/domain/amount-history";
import {
  addMonthId,
  canMoveOccurrence,
  isSalaryPromptVisible,
  occurrenceMoveRange,
} from "@/domain/budget-month";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { seriesAmountPromptFor, type SeriesAmountPrompt } from "@/domain/series-lifecycle";
import type { ExpenseOccurrence } from "@/domain/types";
import { CaptureCommandReview } from "@/features/expenses/components/CaptureCommandReview";
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
import { SeriesAmountPromptSheet } from "@/features/expenses/components/SeriesAmountQuestion";
import { OnboardingCard } from "@/features/expenses/components/onboarding/OnboardingCard";
import { CatalogButton } from "@/features/expenses/components/catalog/CatalogButton";
import { ExpenseCatalogSheet } from "@/features/expenses/components/catalog/ExpenseCatalogSheet";
import { RowReminderProvider } from "@/features/expenses/components/row/RowReminderContext";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useExpenseCaptureFlow } from "@/features/expenses/hooks/use-expense-capture-flow";
import { useExpenseCatalog } from "@/features/expenses/hooks/use-expense-catalog";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useOccurrenceDeepLink } from "@/features/expenses/hooks/use-occurrence-deep-link";
import { useReminderBell } from "@/features/expenses/hooks/use-reminder-bell";
import { useMonthCloseSheet } from "@/features/expenses/hooks/use-month-close-sheet";
import { useOnboarding } from "@/features/expenses/hooks/use-onboarding";
import { useSeriesAmountPrompt } from "@/features/expenses/hooks/use-series-amount-prompt";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useQuickExpenseParser } from "@/features/expenses/hooks/use-quick-expense-parser";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useViewTransitionAction } from "@/features/expenses/hooks/use-view-transition-action";
import { buildLastChanceReminders } from "@/features/expenses/lib/last-chance-reminders";
import { buildQuickAddDraft } from "@/features/expenses/lib/onboarding";
import {
  capitalize,
  formatMonthName,
  periodRangeLabel,
} from "@/features/expenses/lib/month-view";
import {
  markNewExpenseIntentHandled,
  readNewExpenseIntent,
} from "@/features/expenses/lib/new-expense-intent";
import { MonthSummaryLayer } from "@/features/plan/components/MonthSummaryLayer";
import { PlanSettingsFormSheet } from "@/features/plan/components/PlanSettingsSheet";
import { SalaryPromptCard } from "@/features/plan/components/SalaryPromptCard";
import { usePlanBaseSettings } from "@/features/plan/hooks/use-plan-base-settings";
import { useSalaryPrompt } from "@/features/plan/hooks/use-salary-prompt";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { t } from "@/shared/i18n";
import {
  paidOtherAmounts,
  type ConfirmedCaptureCommand,
} from "@/stores/app/capture-command-actions";

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
    setTemplateReminder,
    closeMonth,
    reopenMonth,
    setSeriesAmount,
    recordSalaryReceipt,
    undoSalaryReceipt,
    createCategory,
    applyCaptureCommands,
    revertCaptureCommands,
    syncStatus,
  } = useExpenseStore();
  const language = store.preferences?.language ?? "es";
  const now = useCurrentDate();
  const month = useActiveMonth({ store, language, now, closeMonth, reopenMonth });
  const filters = useExpenseFilters(store, language, now, month.viewMonthId);
  const actionToast = useActionToast();
  // "Ver resumen": el mismo resumen del mes, con sus acciones, que en Mes.
  const [summaryMonthId, setSummaryMonthId] = useState<string | null>(null);
  const reminderBell = useReminderBell({
    store,
    language,
    setTemplateReminder,
    showToast: actionToast.show,
    dismissToast: actionToast.dismiss,
  });
  // Cobro tocado en la lista: abre sus acciones.
  const [selectedOccurrence, setSelectedOccurrence] = useState<ExpenseOccurrence | null>(null);
  const deepLink = useOccurrenceDeepLink({
    store,
    language,
    activeMonthId: month.activeMonthId,
    viewMonthId: month.viewMonthId,
    visibleOccurrences: filters.visibleOccurrences,
    showMonth: month.show,
    // El enlace de un aviso abre las acciones del cobro (pagar, mover...).
    onOpen: (occurrence) => setSelectedOccurrence(occurrence),
    onMissing: () =>
      actionToast.show({ message: t("reminders.deepLinkMissing", language) }),
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
  // Sueldo y día de cobro desde la guía, con la misma hoja que Mes y Ajustes.
  const salaryForm = usePlanBaseSettings(month.activeMonthId);
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
  const router = useRouter();
  const catalog = useExpenseCatalog(store, filters.today, language);
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Recibos variables: al pagar otro importe desde las acciones del cobro se
  // sugiere la media de los últimos pagos.
  const paidSuggestion = useMemo(
    () =>
      selectedOccurrence
        ? suggestedPaidAmount(
            store,
            selectedOccurrence.template.id,
            selectedOccurrence.occurrenceDate,
            language,
          )
        : null,
    [language, selectedOccurrence, store],
  );
  // Tras pagar otro importe con una orden de la captura, la misma pregunta
  // que en las acciones del cobro: "¿Actualizar el importe desde ahora?".
  const commandSeriesPrompt = useSeriesAmountPrompt({ store, setSeriesAmount });
  const salaryPrompt = useSalaryPrompt({
    finance: store.finance,
    now,
    language,
    recordSalaryReceipt,
    onRecorded: (input) => {
      actionToast.show({
        message: capitalize(
          t("salary.received", language).replace(
            "{month}",
            formatMonthName(input.monthId, language),
          ),
        ),
        actionLabel: t("common.undo", language),
        onAction: () => {
          undoSalaryReceipt(input.monthId);
          actionToast.dismiss();
        },
      });
      // La tarjeta desaparece con el botón que tenía el foco.
      focusMonthHeading();
    },
  });
  const showSalaryPrompt = isSalaryPromptVisible(
    salaryPrompt.prompt,
    month.viewMonthId,
    month.activeMonthId,
  );
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

  // "Los próximos cobros de Luz pasan a costar 71,20 €", sin pisar otro aviso
  // (p. ej. "Octubre al día · Pasar a noviembre" o deshacer las órdenes).
  function announceSeriesAmount(prompt: SeriesAmountPrompt) {
    if (actionToast.toast) return;
    actionToast.show({
      message: t("bills.seriesUpdated", language)
        .replace("{name}", prompt.name)
        .replace("{amount}", formatCurrency(prompt.to)),
    });
  }

  function applyCommands(confirmed: ConfirmedCaptureCommand[]) {
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
    // Un recibo pagado con otro importe: se pregunta por el primero, como al
    // pagarlo desde sus acciones. Mientras se responde, el aviso con
    // "Deshacer" queda bajo la hoja: no se cierra hasta que se conteste.
    const [paidOther] = paidOtherAmounts(confirmed);
    if (
      paidOther &&
      commandSeriesPrompt.askAfterPayment(paidOther.templateId, paidOther.amount, now)
    ) {
      actionToast.pause();
    }
  }

  function closeCommandSeriesPrompt(apply: boolean) {
    const applied = apply ? commandSeriesPrompt.apply() : null;
    if (!apply) commandSeriesPrompt.dismiss();
    actionToast.resume();
    if (applied) announceSeriesAmount(applied);
  }

  // No se mueve a un mes ya cerrado ni más allá del mes que se puede ver
  // después del abierto. Es la misma regla que siguen las órdenes de la
  // captura: con el ciclo anclado al cobro, el mes abierto empieza el día de
  // cobro, pero nunca antes del mes natural en curso.
  const openMonthId =
    month.activeMonthId > month.calendarMonthId ? month.activeMonthId : month.calendarMonthId;
  const moveRange = occurrenceMoveRange(openMonthId, month.cycle, filters.today);
  // Lo mismo decide si un cobro se mueve desde sus acciones y arrastrándolo.
  const canMove = (occurrence: ExpenseOccurrence) =>
    canMoveOccurrence(occurrence, openMonthId, month.cycle, filters.today);

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
        {/* Cada pestaña tiene su h1; a la vista, el mes lo dice la barra. */}
        <h1 className="sr-only">{t("common.expenses", language)}</h1>
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
        {showSalaryPrompt && salaryPrompt.prompt ? (
          <SalaryPromptCard
            prompt={salaryPrompt.prompt}
            editing={salaryPrompt.editing}
            amountText={salaryPrompt.amountText}
            language={language}
            onConfirm={salaryPrompt.confirm}
            onStartOther={salaryPrompt.startOther}
            onCancelOther={salaryPrompt.cancelOther}
            onAmountTextChange={salaryPrompt.setAmountText}
            onSaveOther={salaryPrompt.saveOther}
            onDismiss={() => {
              salaryPrompt.dismiss();
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
            variant={closeCardVariant ?? "settled"}
            onAdvance={advanceMonth}
            onReview={() => closeSheet.open(month.closeStatus.leftovers)}
            onDismiss={() => {
              month.dismiss();
              focusMonthHeading();
            }}
            onOpenSummary={() => setSummaryMonthId(month.calendarMonthId)}
          />
        ) : null}
      </div>

      <RowReminderProvider value={reminderBell}>
        <ExpenseList
          sections={filters.timelineSections}
          categories={store.categories}
          today={filters.today}
          monthId={month.viewMonthId}
          openMonthId={filters.today.slice(0, 7)}
          dropFloorDate={month.dropFloorDate}
          canMoveOccurrence={canMove}
          autoScroll={!showCloseCard && !onboarding.visible && !deepLink.openedFromLink}
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
      </RowReminderProvider>

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

      {commandSeriesPrompt.prompt ? (
        <SeriesAmountPromptSheet
          prompt={commandSeriesPrompt.prompt}
          language={language}
          onApply={() => closeCommandSeriesPrompt(true)}
          onKeep={() => closeCommandSeriesPrompt(false)}
        />
      ) : null}

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
        reminderPreferences={reminderBell.preferences}
        categories={store.categories}
        onCreateCategory={createCategory}
        onClose={capture.closeForm}
        onSave={capture.saveForm}
      />

      <PlanSettingsFormSheet form={salaryForm} language={language} />

      {catalogOpen ? (
        <ExpenseCatalogSheet
          items={catalog.items}
          categories={store.categories}
          language={language}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}

      {selectedOccurrence ? (
        <OccurrenceActionSheet
          key={selectedOccurrence.id}
          occurrence={selectedOccurrence}
          minMoveDate={moveRange.min}
          maxMoveDate={moveRange.max}
          canMove={canMove(selectedOccurrence)}
          language={language}
          onClose={() => setSelectedOccurrence(null)}
          onTogglePaid={togglePaidWithMonthCheck}
          onPayAmount={payOtherAmount}
          // Mover desde aquí solo toca este cobro (override), nunca la serie.
          onMove={(occurrence, dueDate) =>
            runViewTransition(() => moveOccurrence(occurrence, dueDate))
          }
          onSkip={skipWithUndo}
          suggestion={paidSuggestion}
          seriesPromptFor={(occurrence, amount) =>
            seriesAmountPromptFor(store, occurrence.template.id, amount, toDateOnly(now))
          }
          onApplySeries={(prompt) => {
            setSeriesAmount(prompt.templateId, prompt.to);
            announceSeriesAmount(prompt);
          }}
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

      {summaryMonthId ? (
        <MonthSummaryLayer
          monthId={summaryMonthId}
          today={filters.today}
          language={language}
          onClose={() => setSummaryMonthId(null)}
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

