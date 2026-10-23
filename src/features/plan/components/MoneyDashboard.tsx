"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  isEventInMonth,
  toMonthId,
} from "@/domain/finance";
import { buildPaydayOutlook, defaultDateInMonth } from "@/domain/budget-month";
import type { AppLanguage } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { MonthBar } from "@/features/expenses/components/MonthBar";
import { useActiveMonth } from "@/features/expenses/hooks/use-active-month";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { t } from "@/shared/i18n";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { useMonthlySalaryEditor } from "../hooks/use-monthly-salary-editor";
import { useCompactChart } from "../hooks/use-compact-chart";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useIncomeRemovalConfirmation } from "../hooks/use-income-removal-confirmation";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import {
  buildSeriesItem,
  getAvailableYears,
  occurrencesForMonth,
  phaseLabel,
  planCopy,
} from "../lib/plan-dashboard";
import { AnnualPlanSection } from "./AnnualPlanSection";
import { CurrentMonthPlanSection } from "./CurrentMonthPlanSection";
import { MonthlyReviewSection } from "./MonthlyReviewSection";
import { MonthlySalaryDialog } from "./MonthlySalaryDialog";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { RemoveIncomeDialog } from "./RemoveIncomeDialog";
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
    closeMonth,
    reopenMonth,
  } = expenseStore;
  const chrome = useScrollChrome();
  const isCompactChart = useCompactChart();
  const language = store.preferences?.language ?? "es";
  const copy = planCopy(language);
  const locale = language === "en" ? enUS : es;
  const today = useCurrentDate();
  const todayDateOnly = toDateOnly(today);
  // Plan sigue al mes que se mira en Gastos (compartido por pestaña). El mes
  // activo es la fase "actual": tras pasar a noviembre, Plan y Gastos cuentan
  // lo mismo.
  const month = useActiveMonth({ store, language, now: today, closeMonth, reopenMonth });
  const monthHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeMonthId = month.activeMonthId;
  const currentMonthId = month.viewMonthId;
  const currentMonthDate = useMemo(
    () => parseISO(`${currentMonthId}-01`),
    [currentMonthId],
  );
  const viewYear = currentMonthDate.getFullYear();
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
        activeMonthId,
      }),
    [activeMonthId, currentMonthDate, currentOccurrences, store.finance, today],
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
  const monthlyIncomeEvents = store.finance.incomeEvents.filter((event) =>
    isEventInMonth(event, currentMonthDate),
  );
  const monthLabel = format(currentMonthDate, "MMMM yyyy", { locale });
  const savingsLabel =
    currentMonthId === activeMonthId
      ? copy.savingsThisMonth
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
        ),
      ),
    [activeMonthId, annualYear, language, store, today],
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
        ),
      ),
    [activeMonthId, language, reviewYear, store, today],
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

  // La base del plan (sueldo, día de cobro, objetivo) rige desde el mes
  // activo aunque se esté mirando otro.
  const settingsForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    savingsMonthId: activeMonthId,
    onSave: updateMoneySettings,
  });
  // Un ingreso extra cuenta en el mes que se está viendo: hoy si es el
  // natural, su día 1 si es posterior y su último día si ya pasó.
  const incomeDate = defaultDateInMonth(currentMonthId, todayDateOnly);
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
            copy={copy}
            monthLabel={monthLabel}
            phaseLabel={plan.phase === "current" ? null : phaseLabel(plan.phase, copy)}
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
            onUpdateMonthlyExpense={updateMonthlyExpenseOccurrence}
          />
        </div>

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
          onDeleteIncomeEvent={incomeRemoval.requestRemoval}
          onUpdateIncomeEvent={updateIncomeEvent}
          onToggleExpanded={() => setExpandedReview((value) => !value)}
          onSkipOccurrence={skipDialog.requestSkipOccurrence}
          onTogglePaid={togglePaid}
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
                onDeleteIncomeEvent={incomeRemoval.requestRemoval}
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
              <MoneyInput
                value={savingsActualText}
                allowZero
                onValueChange={setSavingsActualText}
                invalidMessage={t("money.amountInvalid", language)}
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

      <RemoveIncomeDialog
        incomeEvent={incomeRemoval.incomeToRemove}
        language={language}
        onCancel={incomeRemoval.cancelRemoval}
        onConfirm={incomeRemoval.confirmRemoval}
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
