"use client";

import { useRef, useState } from "react";
import { ActionToast } from "@/components/ui/ActionToast";
import { defaultDateInMonth, isSalaryPromptVisible } from "@/domain/budget-month";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { MonthBar } from "@/features/expenses/components/MonthBar";
import { SeriesAmountPromptSheet } from "@/features/expenses/components/SeriesAmountQuestion";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import {
  capitalize,
  formatMonthName,
  periodRangeLabel,
} from "@/features/expenses/lib/month-view";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { formatMessage, t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useAccountSummaries } from "../hooks/use-account-summaries";
import { useIncomeRemovalConfirmation } from "../hooks/use-income-removal-confirmation";
import { useMonthPlan } from "../hooks/use-month-plan";
import { useMonthlyExpenseActions } from "../hooks/use-monthly-expense-actions";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanBaseSettings } from "../hooks/use-plan-base-settings";
import { useSalaryPrompt } from "../hooks/use-salary-prompt";
import { useSavingsContributionEditor } from "../hooks/use-savings-contribution-editor";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { billsAccountLabel } from "../lib/accounts-headline";
import { isSummaryHighlighted } from "../lib/month-summary";
import { phaseLabel } from "../lib/plan-dashboard";
import { BillsCoverageLine } from "./BillsCoverageLine";
import { ExtraIncomeSheet } from "./ExtraIncomeSheet";
import { MonthEquationSection } from "./MonthEquationSection";
import { MonthReceiptsList } from "./MonthReceiptsList";
import { MonthSummaryLayer } from "./MonthSummaryLayer";
import { MonthSummaryRow } from "./MonthSummaryRow";
import { NextReceiptCard } from "./NextReceiptCard";
import { PaydayOutlookCard } from "./PaydayOutlookCard";
import { PlanActionRows } from "./PlanActionRows";
import { PlanSettingsFormSheet } from "./PlanSettingsSheet";
import { RemoveIncomeDialog } from "./RemoveIncomeDialog";
import { SalaryPromptCard } from "./SalaryPromptCard";
import { SavingsContributionSheet } from "./SavingsContributionSheet";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";

// Pestaña Mes (/money): cuánto queda libre en el mes que se mira, qué falta
// por pagar y el resumen del mes.
export function MonthDashboard() {
  const {
    store,
    togglePaid,
    skipOccurrence,
    addIncomeEvent,
    deleteIncomeEvent,
    updateIncomeEvent,
    updateMonthlyExpenseOccurrence,
    updateMonthlySavingsContribution,
    setSeriesAmount,
    recordSalaryReceipt,
    undoSalaryReceipt,
    closeMonth,
    reopenMonth,
  } = useExpenseStore();
  const chrome = useScrollChrome();
  const language = store.preferences?.language ?? "es";
  const today = useCurrentDate();
  const todayDateOnly = toDateOnly(today);
  // Mes sigue al mes que se mira en Gastos (compartido por pestaña). El mes
  // activo es la fase "actual": tras pasar a noviembre, Mes y Gastos cuentan
  // lo mismo. Mes natural o ciclo desde el día de cobro, según Ajustes.
  const month = useActiveMonth({ store, language, now: today, closeMonth, reopenMonth });
  const { viewMonthId, activeMonthId, cycle } = month;
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  const { plan, receipts, paydayOutlook, incomeEvents } = useMonthPlan({
    store,
    viewMonthId,
    activeMonthId,
    cycle,
    today,
    language,
  });
  // Las cuentas se comparan con el mes activo.
  const accounts = useAccountSummaries({ store, activeMonthId, cycle, language });
  const actionToast = useActionToast();
  // La base del plan rige desde el mes activo aunque se mire otro.
  const settingsForm = usePlanBaseSettings(activeMonthId);
  const savingsEditor = useSavingsContributionEditor({
    finance: store.finance,
    language,
    onSave: updateMonthlySavingsContribution,
  });
  const expenseActions = useMonthlyExpenseActions({
    store,
    language,
    updateMonthlyExpenseOccurrence,
    setSeriesAmount,
  });
  const salaryPrompt = useSalaryPrompt({
    finance: store.finance,
    now: today,
    language,
    recordSalaryReceipt,
    onRecorded: (input) => {
      actionToast.show({
        message: capitalize(
          formatMessage(
            "salary.received",
            { month: formatMonthName(input.monthId, language) },
            language,
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
  // Un ingreso extra cuenta en el mes que se está viendo: hoy si es el
  // natural, su primer día si es posterior y su último día si ya pasó.
  const oneOffIncome = useOneOffIncomeForm({
    today: defaultDateInMonth(viewMonthId, todayDateOnly, cycle),
    onAddIncome: addIncomeEvent,
  });
  const skipDialog = useSkipOccurrenceConfirmation(skipOccurrence);
  const incomeRemoval = useIncomeRemovalConfirmation(
    store.finance.incomeEvents,
    deleteIncomeEvent,
  );
  const [extraSheetOpen, setExtraSheetOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [summaryMonthId, setSummaryMonthId] = useState<string | null>(null);

  const viewingActive = viewMonthId === activeMonthId;
  const monthName = formatMonthName(viewMonthId, language);
  const savingsLabel = viewingActive
    ? t("plan.savingsThisMonth", language)
    : capitalize(formatMessage("monthClose.savingsForMonth", { month: monthName }, language));
  const summaryHighlighted =
    plan.plannedExpenseCount > 0 &&
    isSummaryHighlighted({
      today: todayDateOnly,
      calendarMonthId: month.calendarMonthId,
      activeMonthId,
      cycle,
      viewMonthId,
    });

  function focusMonthHeading() {
    window.requestAnimationFrame(() => monthHeadingRef.current?.focus());
  }

  return (
    <DashboardShell
      headlineLabel={formatCurrency(plan.freeAccordingToPlan)}
      headlineTitle={formatMessage("plan.freeHeadline", { month: monthName }, language)}
      activeTab="money"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <div className="grid w-full min-w-0 gap-8 overflow-hidden pb-8 pt-1 sm:gap-10">
        <div className="grid min-w-0 gap-3">
          {/* El título de la página es para el lector de pantalla: a la vista,
              el mes lo dice la barra. */}
          <h1 className="sr-only">
            {formatMessage(
              "plan.planFor",
              { month: formatMonthName(viewMonthId, language, { withYear: true }) },
              language,
            )}
          </h1>
          <MonthBar
            monthId={viewMonthId}
            rangeLabel={periodRangeLabel(viewMonthId, cycle, language)}
            badge={
              plan.phase === "current" ? null : (
                <span className="rounded-full bg-[var(--app-panel-soft-alpha)] px-2.5 py-0.5 font-semibold">
                  {phaseLabel(plan.phase, language)}
                </span>
              )
            }
            activeMonthId={activeMonthId}
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
            titleAs="p"
          />
          {/* Como en Gastos, solo al mirar el mes de esa nómina o el activo. */}
          {isSalaryPromptVisible(salaryPrompt.prompt, viewMonthId, activeMonthId) &&
          salaryPrompt.prompt ? (
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
        </div>

        <div className="min-w-0">
          <NextReceiptCard plan={plan} language={language} />
          {paydayOutlook ? (
            <PaydayOutlookCard outlook={paydayOutlook} today={todayDateOnly} language={language} />
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3">
          <MonthEquationSection
            plan={plan}
            language={language}
            onChangeIncome={settingsForm.openSettings}
          />
          {accounts.coverage && viewingActive ? (
            <BillsCoverageLine
              coverage={accounts.coverage}
              accountLabel={billsAccountLabel(accounts.summaries, language)}
              language={language}
            />
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3">
          <PlanActionRows
            plan={plan}
            savingsLabel={savingsLabel}
            language={language}
            onOpenSavings={() => savingsEditor.open(viewMonthId)}
            onOpenExtraIncome={() => setExtraSheetOpen(true)}
          />
          <MonthReceiptsList
            monthId={viewMonthId}
            receipts={receipts.items}
            pendingCount={receipts.pendingCount}
            plan={plan}
            open={receiptsOpen}
            categories={store.categories}
            today={todayDateOnly}
            language={language}
            onToggle={() => setReceiptsOpen((open) => !open)}
            onSkipOccurrence={skipDialog.requestSkipOccurrence}
            onTogglePaid={togglePaid}
            onUpdateMonthlyExpense={expenseActions.updateMonthlyExpense}
            suggestPaidAmount={expenseActions.suggestPaidAmount}
          />
          <MonthSummaryRow
            monthId={viewMonthId}
            plan={plan}
            highlighted={summaryHighlighted}
            language={language}
            onOpen={() => setSummaryMonthId(viewMonthId)}
          />
        </div>
      </div>

      <PlanSettingsFormSheet form={settingsForm} language={language} />

      {extraSheetOpen ? (
        <ExtraIncomeSheet
          form={oneOffIncome}
          extraIncomeTotal={plan.extraIncomeTotal}
          incomeEvents={incomeEvents}
          language={language}
          onDeleteIncomeEvent={incomeRemoval.requestRemoval}
          onUpdateIncomeEvent={updateIncomeEvent}
          onClose={() => setExtraSheetOpen(false)}
        />
      ) : null}

      <SavingsContributionSheet editor={savingsEditor} language={language} />

      {summaryMonthId ? (
        <MonthSummaryLayer
          monthId={summaryMonthId}
          today={todayDateOnly}
          language={language}
          onClose={() => setSummaryMonthId(null)}
        />
      ) : null}

      <SkipOccurrenceDialog
        occurrence={skipDialog.occurrenceToSkip}
        language={language}
        onCancel={skipDialog.cancelSkipOccurrence}
        onConfirm={skipDialog.confirmSkipOccurrence}
      />

      <RemoveIncomeDialog
        incomeEvent={incomeRemoval.incomeToRemove}
        language={language}
        onCancel={incomeRemoval.cancelRemoval}
        onConfirm={incomeRemoval.confirmRemoval}
      />

      {expenseActions.seriesPrompt.prompt ? (
        <SeriesAmountPromptSheet
          prompt={expenseActions.seriesPrompt.prompt}
          language={language}
          onApply={() => {
            const applied = expenseActions.seriesPrompt.apply();
            if (!applied) return;
            actionToast.show({
              message: formatMessage(
                "bills.seriesUpdated",
                { name: applied.name, amount: formatCurrency(applied.to) },
                language,
              ),
            });
          }}
          onKeep={expenseActions.seriesPrompt.dismiss}
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
      ) : null}
    </DashboardShell>
  );
}
