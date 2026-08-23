"use client";

import { type FormEvent, useMemo, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  isEventInMonth,
  toMonthId,
} from "@/domain/finance";
import type { AppLanguage } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { t } from "@/shared/i18n";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { useMonthlySalaryEditor } from "../hooks/use-monthly-salary-editor";
import { useCompactChart } from "../hooks/use-compact-chart";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";
import {
  buildSeriesItem,
  getAvailableYears,
  occurrencesForMonth,
  planCopy,
} from "../lib/plan-dashboard";
import { AnnualPlanSection } from "./AnnualPlanSection";
import { CurrentMonthPlanSection } from "./CurrentMonthPlanSection";
import { MonthlyReviewSection } from "./MonthlyReviewSection";
import { MonthlySalaryDialog } from "./MonthlySalaryDialog";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";

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
  } = expenseStore;
  const chrome = useScrollChrome();
  const isCompactChart = useCompactChart();
  const language = store.preferences?.language ?? "es";
  const copy = planCopy(language);
  const locale = language === "en" ? enUS : es;
  const today = useCurrentDate();
  const currentYear = today.getFullYear();
  const todayDateOnly = toDateOnly(today);
  const currentMonthId = toMonthId(today);
  const currentMonthDate = useMemo(() => startOfMonth(today), [today]);
  const currentOccurrences = useMemo(
    () => occurrencesForMonth(store, currentMonthDate, language),
    [currentMonthDate, language, store],
  );
  const plan = useMemo(
    () =>
      buildMonthlyMoneyPlan({
        monthDate: currentMonthDate,
        finance: store.finance,
        occurrences: currentOccurrences,
        today,
      }),
    [currentMonthDate, currentOccurrences, store.finance, today],
  );
  const pendingOccurrences = currentOccurrences.filter(
    (occurrence) => occurrence.status === "due",
  );
  const monthlyIncomeEvents = store.finance.incomeEvents.filter((event) =>
    isEventInMonth(event, currentMonthDate),
  );
  const monthLabel = format(currentMonthDate, "MMMM yyyy", { locale });
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
  const annualYear = annualYearOverride ?? currentYear;
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
        ),
      ),
    [annualYear, language, store, today],
  );
  const reviewMoneySeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        buildSeriesItem(
          store,
          new Date(reviewYear, index, 1),
          today,
          language,
        ),
      ),
    [language, reviewYear, store, today],
  );
  const availableYears = useMemo(() => getAvailableYears(store, today), [store, today]);
  const selectedSummary =
    reviewMoneySeries.find((item) => item.id === selectedMonthId) ??
    reviewMoneySeries[0];
  const selectedMonthDate = new Date(`${selectedSummary.id}T00:00:00`);
  const previousSummary = buildSeriesItem(
    store,
    subMonths(selectedMonthDate, 1),
    today,
    language,
  );
  const selectedOccurrences = occurrencesForMonth(
    store,
    selectedMonthDate,
    language,
  ).filter((occurrence) => occurrence.status !== "skipped");
  const selectedIncomeEvents = store.finance.incomeEvents.filter((event) =>
    isEventInMonth(event, selectedMonthDate),
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

  const settingsForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    savingsMonthId: currentMonthId,
    onSave: updateMoneySettings,
  });
  const oneOffIncome = useOneOffIncomeForm({
    today: todayDateOnly,
    onAddIncome: addIncomeEvent,
  });
  const skipDialog = useSkipOccurrenceConfirmation(skipOccurrence);
  const salaryEditor = useMonthlySalaryEditor({
    finance: store.finance,
    language,
    monthId: selectedSummary.id,
    monthLabel: selectedSummary.monthLong,
    onSave: updateMonthlySalary,
  });

  function selectReviewYear(year: number) {
    setReviewYearOverride(year === currentYear ? null : year);
    setSelectedMonthIdOverride(
      year === currentYear ? null : `${year}-01-01`,
    );
    setExpandedReview(false);
  }

  function selectAnnualYear(year: number) {
    setAnnualYearOverride(year === currentYear ? null : year);
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
    updateMonthlySavingsContribution({
      monthId: savingsMonthId,
      amount: parseMoneyInput(savingsActualText),
    });
    setSavingsMonthId(null);
  }

  const activeSavingsContribution = savingsMonthId
    ? getMonthlySavingsContribution(store.finance, savingsMonthId)
    : null;

  return (
    <DashboardShell
      headlineLabel={formatCurrency(plan.pendingExpensesTotal)}
      headlineTitle={copy.toPay}
      activeTab="money"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <div className="grid w-full min-w-0 gap-16 overflow-hidden pb-8 pt-1 sm:gap-20">
        <CurrentMonthPlanSection
          language={language}
          copy={copy}
          monthLabel={monthLabel}
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
          onUpdateMonthlyExpense={updateMonthlyExpenseOccurrence}
        />

        <AnnualPlanSection
          language={language}
          copy={copy}
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

        <MonthlyReviewSection
          language={language}
          copy={copy}
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
          onDeleteIncomeEvent={deleteIncomeEvent}
          onUpdateIncomeEvent={updateIncomeEvent}
          onToggleExpanded={() => setExpandedReview((value) => !value)}
          onSkipOccurrence={skipDialog.requestSkipOccurrence}
          onUpdateMonthlyExpense={updateMonthlyExpenseOccurrence}
        />
      </div>

      {settingsForm.settingsOpen ? (
        <PlanSettingsSheet
          language={language}
          salaryAmount={settingsForm.salaryAmount}
          salaryDay={settingsForm.salaryDay}
          savingsTarget={settingsForm.savingsTarget}
          dayPickerOpen={settingsForm.dayPickerOpen}
          onSalaryAmountChange={settingsForm.setSalaryAmount}
          onSalaryDayChange={settingsForm.setSalaryDay}
          onSavingsTargetChange={settingsForm.setSavingsTarget}
          onDayPickerOpenChange={settingsForm.setDayPickerOpen}
          onClose={settingsForm.closeSettings}
          onSubmit={settingsForm.submitSettings}
        />
      ) : null}

      {extraSheetOpen ? (
        <Sheet ariaLabel={copy.extraIncome} onBackdropClick={() => setExtraSheetOpen(false)}>
          <div className="p-5">
            <SheetHeader title={copy.extraIncome} onClose={() => setExtraSheetOpen(false)} language={language} />
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
                onDeleteIncomeEvent={deleteIncomeEvent}
                onUpdateIncomeEvent={updateIncomeEvent}
              />
            </div>
          </div>
        </Sheet>
      ) : null}

      {savingsMonthId ? (
        <Sheet ariaLabel={copy.editSavings} onBackdropClick={() => setSavingsMonthId(null)} contentClassName="sm:max-w-sm">
          <form onSubmit={saveSavings} className="p-5">
            <SheetHeader
              title={copy.editSavings}
              subtitle={format(new Date(`${savingsMonthId}-01T00:00:00`), "MMMM yyyy", { locale })}
              onClose={() => setSavingsMonthId(null)}
              language={language}
            />
            <p className="mt-5 text-sm text-[var(--app-text-muted)]">
              {copy.monthlyGoal}: <span className="app-money font-semibold text-[var(--app-text)]">{formatCurrency(getMonthlySavingsTarget(store.finance, savingsMonthId))}</span>
            </p>
            <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
              {copy.actualTransfer}
              <input
                value={savingsActualText}
                onChange={(event) => setSavingsActualText(event.target.value)}
                inputMode="decimal"
                className="input-control"
              />
            </label>
            {activeSavingsContribution?.source === "legacy" && !activeSavingsContribution.transferredAt ? (
              <p className="mt-3 text-xs text-[var(--app-warning)]">{copy.legacySavingDate}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">{copy.singleContribution}</p>
            <Button type="submit" variant="primary" className="mt-5 w-full">
              {copy.saveSavings}
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
          onAmountChange={salaryEditor.setAmount}
          onSalaryDayChange={salaryEditor.setSalaryDay}
          onDayPickerOpenChange={salaryEditor.setDayPickerOpen}
          onClose={salaryEditor.closeEditor}
          onSubmit={salaryEditor.submit}
        />
      ) : null}

      <SkipOccurrenceDialog
        occurrence={skipDialog.occurrenceToSkip}
        language={language}
        onCancel={skipDialog.cancelSkipOccurrence}
        onConfirm={skipDialog.confirmSkipOccurrence}
      />
    </DashboardShell>
  );
}

function SheetHeader({
  title,
  subtitle,
  onClose,
  language,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  language: AppLanguage;
}) {
  return (
    <>
      <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 capitalize text-sm text-[var(--app-text-muted)]">{subtitle}</p> : null}
        </div>
        <Button type="button" onClick={onClose} variant="ghost" size="sm" className="rounded-full">
          {t("money.close", language)}
        </Button>
      </header>
    </>
  );
}
