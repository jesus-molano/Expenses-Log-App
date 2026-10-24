"use client";

import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { ActionToast } from "@/components/ui/ActionToast";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { suggestedPaidAmount } from "@/domain/amount-history";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  toMonthId,
} from "@/domain/finance";
import {
  buildPaydayOutlook,
  defaultDateInMonth,
  isSalaryPromptVisible,
} from "@/domain/budget-month";
import { periodRange } from "@/domain/budget-cycle";
import type { ExpenseOccurrence } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { MonthBar } from "@/features/expenses/components/MonthBar";
import { SeriesAmountPromptSheet } from "@/features/expenses/components/SeriesAmountQuestion";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useSeriesAmountPrompt } from "@/features/expenses/hooks/use-series-amount-prompt";
import {
  capitalize,
  formatMonthName,
  periodRangeLabel,
} from "@/features/expenses/lib/month-view";
import type { MonthlyExpenseOverrideInput } from "@/stores/app/store-types";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { formatMessage, t } from "@/shared/i18n";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { useMonthlySalaryEditor } from "../hooks/use-monthly-salary-editor";
import { useCompactChart } from "../hooks/use-compact-chart";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { useAccountEditor } from "../hooks/use-account-editor";
import { useAccountSummaries } from "../hooks/use-account-summaries";
import { useBalanceCheckinForm } from "../hooks/use-balance-checkin-form";
import { useMonthSummary, useMonthSummaryPrompt } from "../hooks/use-month-summary";
import { usePlanInsights } from "../hooks/use-plan-insights";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useIncomeRemovalConfirmation } from "../hooks/use-income-removal-confirmation";
import { useSalaryPrompt } from "../hooks/use-salary-prompt";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import {
  buildSeriesItem,
  formatShortDate,
  getAvailableYears,
  incomeEventsInMonth,
  occurrencesForMonth,
  phaseLabel,
} from "../lib/plan-dashboard";
import { accountDisplayName } from "../lib/account-labels";
import { AccountEditorSheet } from "./AccountEditorSheet";
import { AccountsSection } from "./AccountsSection";
import { AnnualPlanSection } from "./AnnualPlanSection";
import { BalanceCheckinSheet } from "./BalanceCheckinSheet";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { CurrentMonthPlanSection } from "./CurrentMonthPlanSection";
import { MonthlyReviewSection } from "./MonthlyReviewSection";
import { MonthlySalaryDialog } from "./MonthlySalaryDialog";
import { MonthSummaryPrompt } from "./MonthSummaryPrompt";
import { MonthSummarySheet } from "./MonthSummarySheet";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { PlanSheetHeader as SheetHeader } from "./PlanSheetHeader";
import { RecurringCostSection } from "./RecurringCostSection";
import { RemoveIncomeDialog } from "./RemoveIncomeDialog";
import { SalaryPromptCard } from "./SalaryPromptCard";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";
import { UpcomingBillsSection } from "./UpcomingBillsSection";

export function MoneyDashboard() {
  const expenseStore = useExpenseStore();
  const {
    store,
    updateMoneySettings,
    updateMonthlySavingsContribution,
    updateMonthlySalary,
    addIncomeEvent,
    deleteIncomeEvent,
    updateIncomeEvent,
    updateMonthlyExpenseOccurrence,
    skipOccurrence,
    togglePaid,
    setSeriesAmount,
    updateSalaryExtraPay,
    recordSalaryReceipt,
    undoSalaryReceipt,
    closeMonth,
    reopenMonth,
    addBalanceAccount,
    updateBalanceAccount,
    moveBalanceAccount,
    deleteBalanceAccount,
    recordAccountBalance,
    deleteAccountBalance,
  } = expenseStore;
  const chrome = useScrollChrome();
  const isCompactChart = useCompactChart();
  const language = store.preferences?.language ?? "es";
  const locale = language === "en" ? enUS : es;
  const today = useCurrentDate();
  const todayDateOnly = toDateOnly(today);
  // Plan sigue al mes que se mira en Gastos (compartido por pestaña). El mes
  // activo es la fase "actual": tras pasar a noviembre, Plan y Gastos cuentan
  // lo mismo.
  const month = useActiveMonth({ store, language, now: today, closeMonth, reopenMonth });
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  // Mes natural o ciclo desde el día de cobro, según Ajustes (el mismo que
  // usa Gastos).
  const cycle = month.cycle;
  const activeMonthId = month.activeMonthId;
  const currentMonthId = month.viewMonthId;
  const currentMonthDate = useMemo(
    () => parseISO(`${currentMonthId}-01`),
    [currentMonthId],
  );
  const currentMonthRange = useMemo(
    () => periodRange(currentMonthId, cycle),
    [currentMonthId, cycle],
  );
  const viewYear = currentMonthDate.getFullYear();
  const currentOccurrences = useMemo(
    () => occurrencesForMonth(store, currentMonthDate, language, cycle),
    [currentMonthDate, cycle, language, store],
  );
  const plan = useMemo(
    () =>
      buildMonthlyMoneyPlan({
        monthDate: currentMonthDate,
        finance: store.finance,
        occurrences: currentOccurrences,
        today,
        activeMonthId,
        range: currentMonthRange,
      }),
    [
      activeMonthId,
      currentMonthDate,
      currentMonthRange,
      currentOccurrences,
      store.finance,
      today,
    ],
  );
  const paydayOutlook = useMemo(
    () =>
      currentMonthId === activeMonthId
        ? buildPaydayOutlook(store, todayDateOnly, language)
        : null,
    [activeMonthId, currentMonthId, language, store, todayDateOnly],
  );
  const pendingOccurrences = currentOccurrences.filter(
    (occurrence) => occurrence.status === "due",
  );
  const monthlyIncomeEvents = incomeEventsInMonth(
    store.finance,
    currentMonthId,
    cycle,
  );
  const monthLabel = format(currentMonthDate, "MMMM yyyy", { locale });
  const periodLabel = periodRangeLabel(currentMonthId, cycle, language);
  // Las previsiones miran hacia delante desde el mes activo, aunque se esté
  // mirando otro.
  const insights = usePlanInsights({
    store,
    monthId: activeMonthId,
    cycle,
    today: todayDateOnly,
    language,
  });
  const monthSummary = useMonthSummary({ store, today: todayDateOnly, language });
  const summaryPrompt = useMonthSummaryPrompt({
    store,
    today: todayDateOnly,
    language,
    cycle,
    calendarMonthId: month.calendarMonthId,
    activeMonthId,
  });
  // Cuentas: se comparan con el mes activo aunque se esté mirando otro.
  const accounts = useAccountSummaries({ store, activeMonthId, cycle, language });
  const checkinForm = useBalanceCheckinForm({
    summaries: accounts.summaries,
    today: todayDateOnly,
    language,
    onRecord: recordAccountBalance,
  });
  const actionToast = useActionToast();
  const accountEditor = useAccountEditor({
    summaries: accounts.summaries,
    onAdd: addBalanceAccount,
    onUpdate: updateBalanceAccount,
    onDelete: (summary) => {
      deleteBalanceAccount(summary.account.id);
      actionToast.show({
        message: formatMessage(
          "insights.accounts.deleted",
          { name: accountDisplayName(summary.account, language) },
          language,
        ),
      });
    },
  });

  function deleteBalanceWithUndo(accountId: string, entry: { date: string; amount: number }) {
    deleteAccountBalance({ accountId, date: entry.date });
    actionToast.show({
      message: t("insights.balance.deleted", language).replace(
        "{date}",
        formatShortDate(entry.date, language),
      ),
      actionLabel: t("common.undo", language),
      onAction: () => {
        recordAccountBalance({ accountId, ...entry });
        actionToast.dismiss();
      },
    });
  }
  const savingsLabel =
    currentMonthId === activeMonthId
      ? t("plan.savingsThisMonth", language)
      : capitalize(
          t("monthClose.savingsForMonth", language).replace(
            "{month}",
            formatMonthName(currentMonthId, language),
          ),
        );
  const paidProgress = plan.plannedExpenseCount
    ? Math.round((plan.paidExpenseCount / plan.plannedExpenseCount) * 100)
    : 0;

  const [annualYearOverride, setAnnualYearOverride] = useState<number | null>(null);
  const [reviewYearOverride, setReviewYearOverride] = useState<number | null>(null);
  const [selectedMonthIdOverride, setSelectedMonthIdOverride] = useState<
    string | null
  >(null);
  const [expandedReview, setExpandedReview] = useState(false);
  const [extraSheetOpen, setExtraSheetOpen] = useState(false);
  const [savingsMonthId, setSavingsMonthId] = useState<string | null>(null);
  const [savingsActualText, setSavingsActualText] = useState("");
  const annualYear = annualYearOverride ?? viewYear;
  const selectedMonthId =
    selectedMonthIdOverride ?? toDateOnly(currentMonthDate);
  const reviewYear =
    reviewYearOverride ?? Number(selectedMonthId.slice(0, 4));

  const annualMoneySeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        buildSeriesItem(
          store,
          new Date(annualYear, index, 1),
          today,
          language,
          activeMonthId,
          cycle,
        ),
      ),
    [activeMonthId, annualYear, cycle, language, store, today],
  );
  const reviewMoneySeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        buildSeriesItem(
          store,
          new Date(reviewYear, index, 1),
          today,
          language,
          activeMonthId,
          cycle,
        ),
      ),
    [activeMonthId, cycle, language, reviewYear, store, today],
  );
  // Al pasar de diciembre a enero, el año activo y el que se mira también se
  // pueden elegir.
  const availableYears = useMemo(
    () =>
      getAvailableYears(store, today, [activeMonthId, currentMonthId]).sort(
        (a, b) => a - b,
      ),
    [activeMonthId, currentMonthId, store, today],
  );
  const selectedSummary =
    reviewMoneySeries.find((item) => item.id === selectedMonthId) ??
    reviewMoneySeries[0];
  const selectedMonthDate = new Date(`${selectedSummary.id}T00:00:00`);
  const previousSummary = buildSeriesItem(
    store,
    subMonths(selectedMonthDate, 1),
    today,
    language,
    activeMonthId,
    cycle,
  );
  const selectedOccurrences = occurrencesForMonth(
    store,
    selectedMonthDate,
    language,
    cycle,
  ).filter((occurrence) => occurrence.status !== "skipped");
  const selectedIncomeEvents = incomeEventsInMonth(
    store.finance,
    selectedSummary.id.slice(0, 7),
    cycle,
  );
  const visibleSelectedOccurrences = expandedReview
    ? selectedOccurrences
    : selectedOccurrences.slice(0, 6);
  const selectedHasLegacyHistory = selectedOccurrences.some(
    (occurrence) => occurrence.record?.source === "legacy-derived",
  );

  const annualExpenses = annualMoneySeries.reduce(
    (sum, item) => sum + (item.plannedExpenses ?? item.expenses),
    0,
  );
  const annualPaid = annualMoneySeries.reduce(
    (sum, item) => sum + (item.paid ?? 0),
    0,
  );
  const annualSavingsActual = annualMoneySeries.reduce(
    (sum, item) => sum + item.savings,
    0,
  );
  const annualCapacity = annualMoneySeries.reduce(
    (sum, item) => sum + (item.capacity ?? 0),
    0,
  );

  // La base del plan (sueldo, día de cobro, objetivo) rige desde el mes
  // activo aunque se esté mirando otro.
  const settingsForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    savingsMonthId: activeMonthId,
    onSave: updateMoneySettings,
    onSaveExtraPay: updateSalaryExtraPay,
  });
  // Recibos variables: tras pagar con otro importe desde Plan se pregunta si
  // los próximos cobros pasan a costar eso.
  const seriesPrompt = useSeriesAmountPrompt({ store, setSeriesAmount });
  const suggestPaidAmount = useCallback(
    (occurrence: ExpenseOccurrence) =>
      suggestedPaidAmount(store, occurrence.template.id, occurrence.occurrenceDate, language),
    [language, store],
  );
  function updateMonthlyExpense(input: MonthlyExpenseOverrideInput) {
    updateMonthlyExpenseOccurrence(input);
    if (
      input.status === "paid" &&
      input.amountPaid !== undefined &&
      input.amountPaid !== input.amount
    ) {
      seriesPrompt.askAfterPayment(input.templateId, input.amountPaid);
    }
  }
  const salaryPrompt = useSalaryPrompt({
    finance: store.finance,
    now: today,
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
  // Como en Gastos, solo al mirar el mes de esa nómina o el activo.
  const salaryPromptCard = isSalaryPromptVisible(
    salaryPrompt.prompt,
    currentMonthId,
    activeMonthId,
  ) ? (
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
  ) : null;
  // Un ingreso extra cuenta en el mes que se está viendo: hoy si es el
  // natural, su primer día si es posterior y su último día si ya pasó.
  const incomeDate = defaultDateInMonth(currentMonthId, todayDateOnly, cycle);
  const oneOffIncome = useOneOffIncomeForm({
    today: incomeDate,
    onAddIncome: addIncomeEvent,
  });
  const skipDialog = useSkipOccurrenceConfirmation(skipOccurrence);
  const incomeRemoval = useIncomeRemovalConfirmation(
    store.finance.incomeEvents,
    deleteIncomeEvent,
  );
  const salaryEditor = useMonthlySalaryEditor({
    finance: store.finance,
    language,
    monthId: selectedSummary.id,
    monthLabel: selectedSummary.monthLong,
    activeMonthId,
    onSave: updateMonthlySalary,
  });

  function selectReviewYear(year: number) {
    setReviewYearOverride(year === viewYear ? null : year);
    setSelectedMonthIdOverride(
      year === viewYear ? null : `${year}-01-01`,
    );
    setExpandedReview(false);
  }

  function selectAnnualYear(year: number) {
    setAnnualYearOverride(year === viewYear ? null : year);
  }

  // Al cambiar de mes, la revisión y el año del gráfico vuelven a seguirlo.
  function followViewMonth() {
    setAnnualYearOverride(null);
    setReviewYearOverride(null);
    setSelectedMonthIdOverride(null);
    setExpandedReview(false);
  }

  function focusMonthHeading() {
    window.requestAnimationFrame(() => monthHeadingRef.current?.focus());
  }

  function openSavings(monthId: string) {
    const normalizedMonthId = toMonthId(monthId);
    setSavingsMonthId(normalizedMonthId);
    setSavingsActualText(
      formatMoneyInput(
        getMonthlySavingsContribution(store.finance, normalizedMonthId)?.amount ??
          0,
        language,
      ),
    );
  }

  function saveSavings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!savingsMonthId) return;
    const amount = parseMoneyInput(savingsActualText);
    // Solo un 0 escrito borra la aportación; un texto ilegible no guarda nada.
    if (amount === null) return;
    updateMonthlySavingsContribution({ monthId: savingsMonthId, amount });
    setSavingsMonthId(null);
  }

  const activeSavingsContribution = savingsMonthId
    ? getMonthlySavingsContribution(store.finance, savingsMonthId)
    : null;

  return (
    <DashboardShell
      headlineLabel={formatCurrency(plan.pendingExpensesTotal)}
      headlineTitle={`${t("common.due", language)} · ${formatMonthName(currentMonthId, language)}`}
      activeTab="money"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <div className="grid w-full min-w-0 gap-16 overflow-hidden pb-8 pt-1 sm:gap-20">
        <div className="grid min-w-0 gap-5">
          <MonthBar
            monthId={currentMonthId}
            activeMonthId={activeMonthId}
            calendarMonthId={month.calendarMonthId}
            language={language}
            canBrowseBack={month.canBrowseBack}
            canBrowseForward={month.canBrowseForward}
            onBrowse={(delta) => {
              month.browse(delta);
              followViewMonth();
            }}
            onReset={() => {
              month.reset();
              followViewMonth();
              focusMonthHeading();
            }}
            onReopen={() => {
              month.reopen();
              followViewMonth();
              focusMonthHeading();
            }}
            headingRef={monthHeadingRef}
            titleAs="p"
          />
          <CurrentMonthPlanSection
            language={language}
            monthLabel={monthLabel}
            periodLabel={periodLabel}
            phaseLabel={plan.phase === "current" ? null : phaseLabel(plan.phase, language)}
            savingsLabel={savingsLabel}
            paydayOutlook={paydayOutlook}
            plan={plan}
            paidProgress={paidProgress}
            pendingOccurrences={pendingOccurrences}
            categories={store.categories}
            todayDateOnly={todayDateOnly}
            onOpenSettings={settingsForm.openSettings}
            onOpenSavings={() => openSavings(currentMonthId)}
            onOpenExtraIncome={() => setExtraSheetOpen(true)}
            onSkipOccurrence={skipDialog.requestSkipOccurrence}
            onTogglePaid={togglePaid}
            onUpdateMonthlyExpense={updateMonthlyExpense}
            suggestPaidAmount={suggestPaidAmount}
            notice={salaryPromptCard}
          />
        </div>

        {summaryPrompt ? (
          <MonthSummaryPrompt
            summary={summaryPrompt}
            language={language}
            onOpen={() => monthSummary.open(summaryPrompt.monthId)}
          />
        ) : null}

        <UpcomingBillsSection
          language={language}
          largeBills={insights.largeBills.items}
          largeBillsTotal={insights.largeBills.total}
          provision={insights.provision}
        />

        <AccountsSection
          language={language}
          monthId={activeMonthId}
          summaries={accounts.summaries}
          coverage={accounts.coverage}
          savingsTarget={accounts.savingsTarget}
          onAdd={accountEditor.openAdd}
          onRecord={checkinForm.openForm}
          onEdit={accountEditor.openEdit}
          onMove={moveBalanceAccount}
          onDeleteEntry={deleteBalanceWithUndo}
        />

        <AnnualPlanSection
          language={language}
          year={annualYear}
          availableYears={availableYears}
          moneySeries={annualMoneySeries}
          isCompactChart={isCompactChart}
          annualExpenses={annualExpenses}
          annualPaid={annualPaid}
          annualSavingsActual={annualSavingsActual}
          annualCapacity={annualCapacity}
          onYearChange={selectAnnualYear}
        />

        <RecurringCostSection language={language} insights={insights.costs} />

        <MonthlyReviewSection
          language={language}
          reviewYear={reviewYear}
          availableYears={availableYears}
          selectedSummary={selectedSummary}
          reviewMoneySeries={reviewMoneySeries}
          selectedHasLegacyHistory={selectedHasLegacyHistory}
          previousSummary={previousSummary}
          selectedIncomeEvents={selectedIncomeEvents}
          selectedOccurrences={selectedOccurrences}
          visibleSelectedOccurrences={visibleSelectedOccurrences}
          categories={store.categories}
          todayDateOnly={todayDateOnly}
          expandedReview={expandedReview}
          onYearChange={selectReviewYear}
          onMonthChange={(monthId) => {
            setSelectedMonthIdOverride(
              monthId === toDateOnly(currentMonthDate) ? null : monthId,
            );
            setExpandedReview(false);
          }}
          onEditSalary={salaryEditor.openEditor}
          onEditSavings={() => openSavings(selectedSummary.id)}
          onOpenSummary={() => monthSummary.open(selectedSummary.id.slice(0, 7))}
          onDeleteIncomeEvent={incomeRemoval.requestRemoval}
          onUpdateIncomeEvent={updateIncomeEvent}
          onToggleExpanded={() => setExpandedReview((value) => !value)}
          onSkipOccurrence={skipDialog.requestSkipOccurrence}
          onTogglePaid={togglePaid}
          onUpdateMonthlyExpense={updateMonthlyExpense}
          suggestPaidAmount={suggestPaidAmount}
        />
      </div>

      {settingsForm.settingsOpen ? (
        <PlanSettingsSheet
          language={language}
          salaryAmount={settingsForm.salaryAmount}
          salaryDay={settingsForm.salaryDay}
          savingsTarget={settingsForm.savingsTarget}
          dayPickerOpen={settingsForm.dayPickerOpen}
          extraPayMonths={settingsForm.extraPayMonths}
          extraPayAmount={settingsForm.extraPayAmount}
          onToggleExtraPayMonth={settingsForm.toggleExtraPayMonth}
          onExtraPayAmountChange={settingsForm.setExtraPayAmount}
          onSalaryAmountChange={settingsForm.setSalaryAmount}
          onSalaryDayChange={settingsForm.setSalaryDay}
          onSavingsTargetChange={settingsForm.setSavingsTarget}
          onDayPickerOpenChange={settingsForm.setDayPickerOpen}
          onClose={settingsForm.closeSettings}
          onSubmit={settingsForm.submitSettings}
        />
      ) : null}

      {extraSheetOpen ? (
        <Sheet ariaLabel={t("plan.extraIncome", language)} onBackdropClick={() => setExtraSheetOpen(false)}>
          <div className="p-5">
            <SheetHeader title={t("plan.extraIncome", language)} onClose={() => setExtraSheetOpen(false)} language={language} />
            <div className="mt-5">
              <OneOffIncomePanel
                language={language}
                extraIncomeTotal={plan.extraIncomeTotal}
                incomeEvents={monthlyIncomeEvents}
                extraName={oneOffIncome.extraName}
                extraAmount={oneOffIncome.extraAmount}
                onExtraNameChange={oneOffIncome.setExtraName}
                onExtraAmountChange={oneOffIncome.setExtraAmount}
                onSubmit={oneOffIncome.saveExtra}
                onDeleteIncomeEvent={incomeRemoval.requestRemoval}
                onUpdateIncomeEvent={updateIncomeEvent}
              />
            </div>
          </div>
        </Sheet>
      ) : null}

      {savingsMonthId ? (
        <Sheet ariaLabel={t("plan.editSavings", language)} onBackdropClick={() => setSavingsMonthId(null)} contentClassName="sm:max-w-sm">
          <form onSubmit={saveSavings} className="p-5">
            <SheetHeader
              title={t("plan.editSavings", language)}
              subtitle={format(new Date(`${savingsMonthId}-01T00:00:00`), "MMMM yyyy", { locale })}
              onClose={() => setSavingsMonthId(null)}
              language={language}
            />
            <p className="mt-5 text-sm text-[var(--app-text-muted)]">
              {t("plan.monthlyGoal", language)}: <span className="app-money font-semibold text-[var(--app-text)]">{formatCurrency(getMonthlySavingsTarget(store.finance, savingsMonthId))}</span>
            </p>
            <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
              {t("plan.actualTransfer", language)}
              <MoneyInput
                value={savingsActualText}
                allowZero
                onValueChange={setSavingsActualText}
                invalidMessage={t("money.amountInvalid", language)}
              />
            </label>
            {activeSavingsContribution?.source === "legacy" && !activeSavingsContribution.transferredAt ? (
              <p className="mt-3 text-xs text-[var(--app-warning)]">{t("plan.legacySavingDate", language)}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">{t("plan.singleContribution", language)}</p>
            <Button type="submit" variant="primary" className="mt-5 w-full">
              {t("plan.saveSavings", language)}
            </Button>
          </form>
        </Sheet>
      ) : null}

      {salaryEditor.open ? (
        <MonthlySalaryDialog
          language={language}
          monthLabel={salaryEditor.monthLabel}
          amount={salaryEditor.amount}
          salaryDay={salaryEditor.salaryDay}
          dayPickerOpen={salaryEditor.dayPickerOpen}
          scope={salaryEditor.scope}
          onScopeChange={salaryEditor.setScope}
          onAmountChange={salaryEditor.setAmount}
          onSalaryDayChange={salaryEditor.setSalaryDay}
          onDayPickerOpenChange={salaryEditor.setDayPickerOpen}
          onClose={salaryEditor.closeEditor}
          onSubmit={salaryEditor.submit}
        />
      ) : null}

      {monthSummary.summary ? (
        <MonthSummarySheet
          summary={monthSummary.summary}
          language={language}
          periodLabel={periodRangeLabel(monthSummary.summary.monthId, cycle, language)}
          onClose={monthSummary.close}
        />
      ) : null}

      {checkinForm.formOpen ? (
        <BalanceCheckinSheet
          language={language}
          accountOptions={accounts.summaries.map((summary) => ({
            value: summary.account.id,
            label: accountDisplayName(summary.account, language),
          }))}
          accountId={checkinForm.accountId}
          date={checkinForm.date}
          amountText={checkinForm.amountText}
          maxDate={todayDateOnly}
          replacesEntry={checkinForm.replacesEntry}
          onAccountChange={checkinForm.selectAccount}
          onDateChange={checkinForm.setDate}
          onAmountChange={checkinForm.setAmountText}
          onClose={checkinForm.closeForm}
          onSubmit={checkinForm.submit}
        />
      ) : null}

      {accountEditor.open ? (
        <AccountEditorSheet
          language={language}
          isNew={accountEditor.isNew}
          accountName={
            accountEditor.editing
              ? accountDisplayName(accountEditor.editing.account, language)
              : undefined
          }
          name={accountEditor.name}
          role={accountEditor.role}
          onNameChange={accountEditor.setName}
          onRoleChange={accountEditor.setRole}
          onClose={accountEditor.close}
          onSubmit={accountEditor.submit}
          onDelete={accountEditor.requestDelete}
        />
      ) : null}

      <DeleteAccountDialog
        summary={accountEditor.confirmingDelete ? accountEditor.editing : null}
        language={language}
        onCancel={accountEditor.cancelDelete}
        onConfirm={accountEditor.confirmDelete}
      />

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

      {seriesPrompt.prompt ? (
        <SeriesAmountPromptSheet
          prompt={seriesPrompt.prompt}
          language={language}
          onApply={() => {
            const applied = seriesPrompt.apply();
            if (!applied) return;
            actionToast.show({
              message: t("bills.seriesUpdated", language)
                .replace("{name}", applied.name)
                .replace("{amount}", formatCurrency(applied.to)),
            });
          }}
          onKeep={seriesPrompt.dismiss}
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
