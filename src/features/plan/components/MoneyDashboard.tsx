"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  CalendarClock,
  ChevronRight,
  Plus,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import {
  buildMonthlyMoneyPlan,
  generateStoreOccurrences,
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  isEventInMonth,
  toMonthId,
} from "@/domain/finance";
import type {
  AppLanguage,
  ExpenseStore,
} from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { t } from "@/shared/i18n";
import { useMonthlySalaryEditor } from "../hooks/use-monthly-salary-editor";
import { useCompactChart } from "../hooks/use-compact-chart";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { formatMoneyInput, parseMoneyInput } from "../lib/money-input";
import type { MoneySeriesItem } from "../types";
import { MonthlyExpenseBreakdown } from "./MonthlyExpenseBreakdown";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";
import { MonthlyIncomeEventsList } from "./MonthlyIncomeEventsList";
import { MonthlySalaryDialog } from "./MonthlySalaryDialog";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";

export function MoneyDashboard() {
  const expenseStore = useExpenseStore();
  const {
    store,
    updateMoneySettings,
    updateMonthlySavings,
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
  const today = useMemo(() => new Date(), []);
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

  const [annualYear, setAnnualYear] = useState(today.getFullYear());
  const [reviewYear, setReviewYear] = useState(today.getFullYear());
  const [selectedMonthId, setSelectedMonthId] = useState(
    toDateOnly(startOfMonth(today)),
  );
  const [expandedReview, setExpandedReview] = useState(false);
  const [extraSheetOpen, setExtraSheetOpen] = useState(false);
  const [savingsMonthId, setSavingsMonthId] = useState<string | null>(null);
  const [savingsTargetText, setSavingsTargetText] = useState("");
  const [savingsActualText, setSavingsActualText] = useState("");

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
    setReviewYear(year);
    setSelectedMonthId(`${year}-01-01`);
    setExpandedReview(false);
  }

  function openSavings(monthId: string) {
    const normalizedMonthId = toMonthId(monthId);
    setSavingsMonthId(normalizedMonthId);
    setSavingsTargetText(
      formatMoneyInput(
        getMonthlySavingsTarget(store.finance, normalizedMonthId),
        language,
      ),
    );
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
    updateMonthlySavings({
      monthId: savingsMonthId,
      savingsTarget: parseMoneyInput(savingsTargetText),
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
      <div className="grid w-full min-w-0 gap-10 overflow-hidden pb-8 pt-1 sm:gap-12">
        <section className="min-w-0">
          <header className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold capitalize text-[var(--app-text)]">
                {copy.planFor} {monthLabel}
              </h1>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                {plan.plannedExpenseCount
                  ? `${plan.paidExpenseCount} ${copy.of} ${plan.plannedExpenseCount} ${copy.paidReceipts}`
                  : copy.noReceipts}
              </p>
            </div>
            <IconButton
              type="button"
              onClick={settingsForm.openSettings}
              aria-label={t("money.configure", language)}
              title={t("money.configure", language)}
            >
              <Settings2 size={17} />
            </IconButton>
          </header>

          {plan.plannedExpenseCount ? (
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--app-control)]"
              role="progressbar"
              aria-label={copy.paidProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={paidProgress}
            >
              <div
                className="h-full rounded-full bg-[var(--app-success)] transition-[width]"
                style={{ width: `${paidProgress}%` }}
              />
            </div>
          ) : null}

          <div className="mt-4 flex min-h-11 items-center gap-3 border-y border-[var(--app-border)] py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
              <CalendarClock size={17} />
            </span>
            <div className="min-w-0 flex-1">
              {plan.nextPending ? (
                <>
                  <p className="truncate text-sm font-semibold text-[var(--app-text)]">
                    {plan.nextPending.overdue ? copy.overdue : copy.nextReceipt}: {plan.nextPending.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    <span className="app-money">
                      {formatShortDate(plan.nextPending.dueDate, language)} · {formatCurrency(plan.nextPending.amount)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-[var(--app-success)]">
                  {plan.plannedExpenseCount ? copy.allPaid : copy.noUpcomingReceipt}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="monthly-equation-title" className="min-w-0 px-1">
          <h2 id="monthly-equation-title" className="text-lg font-semibold text-[var(--app-text)]">
            {copy.monthEquation}
          </h2>
          <dl className="mt-4 divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
            <EquationRow
              label={copy.expectedIncome}
              detail={`${copy.fixedIncome} ${formatCurrency(plan.fixedIncomeTotal)} · ${copy.extras} ${formatCurrency(plan.extraIncomeTotal)}`}
              value={plan.plannedIncomeTotal}
            />
            <EquationRow
              label={copy.expectedFinalExpenses}
              detail={`${copy.paid} ${formatCurrency(plan.paidExpensesTotal)} · ${copy.pending} ${formatCurrency(plan.pendingExpensesTotal)}`}
              value={-plan.expectedExpensesTotal}
            />
            <EquationRow
              label={copy.reservedSavings}
              detail={`${copy.goal} ${formatCurrency(plan.savingsTarget)} · ${copy.actual} ${formatCurrency(plan.savingsActual)}`}
              value={-plan.savingsReserved}
            />
            <div className="flex items-end justify-between gap-4 py-4">
              <div>
                <dt className="font-semibold text-[var(--app-text)]">{copy.freeAccordingToPlan}</dt>
                <dd className="mt-1 max-w-lg text-xs leading-relaxed text-[var(--app-text-muted)]">
                  {copy.freeDisclaimer}
                </dd>
              </div>
              <dd className="app-money shrink-0 text-xl font-semibold text-[var(--app-accent)]">
                {formatCurrency(plan.freeAccordingToPlan)}
              </dd>
            </div>
          </dl>
          {plan.billsShortfall > 0 || plan.savingsGoalShortfall > 0 ? (
            <div className="mt-3 flex gap-2 text-sm text-[var(--app-warning)]">
              <TriangleAlert className="mt-0.5 shrink-0" size={16} />
              <p>
                {plan.billsShortfall > 0
                  ? `${copy.missingForReceipts} ${formatCurrency(plan.billsShortfall)}.`
                  : `${copy.unfundedGoal} ${formatCurrency(plan.savingsGoalShortfall)}.`}
              </p>
            </div>
          ) : null}
        </section>

        <button
          type="button"
          onClick={() => openSavings(currentMonthId)}
          className="app-focus-ring flex min-h-14 w-full items-center justify-between gap-4 border-y border-[var(--app-border)] px-1 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--app-text)]">{copy.savingsThisMonth}</span>
            <span className="mt-1 block text-sm text-[var(--app-text-muted)]">
              {copy.actual} {formatCurrency(plan.savingsActual)} · {copy.goal.toLowerCase()} {formatCurrency(plan.savingsTarget)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="app-money font-semibold text-[var(--app-success)]">
              {formatCurrency(plan.savingsActual)}
            </span>
            <ChevronRight size={17} className="text-[var(--app-text-muted)]" />
          </span>
        </button>

        <section className="min-w-0" aria-labelledby="pending-receipts-title">
          <header className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="pending-receipts-title" className="text-lg font-semibold text-[var(--app-text)]">
                {copy.pendingReceipts}
              </h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                {pendingOccurrences.length} · {formatCurrency(plan.pendingExpensesTotal)}
              </p>
            </div>
          </header>
          <div className="app-monthly-table mt-4" data-tone="expense">
            <div className="app-monthly-table-body" data-integrated-list="true">
              {pendingOccurrences.length ? (
                pendingOccurrences.map((occurrence) => (
                  <MonthlyExpenseRow
                    key={occurrence.id}
                    occurrence={occurrence}
                    categories={store.categories}
                    language={language}
                    today={todayDateOnly}
                    skipLabel={t("money.skipMonthExpense", language)}
                    onSkip={() => skipDialog.requestSkipOccurrence(occurrence)}
                    onTogglePaid={() => togglePaid(occurrence)}
                    onUpdate={updateMonthlyExpenseOccurrence}
                  />
                ))
              ) : (
                <p className="px-3 py-4 text-sm font-medium text-[var(--app-text-muted)]">
                  {plan.plannedExpenseCount ? copy.allPaid : copy.noReceipts}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-label={copy.quickActions}>
          <PlanAction
            icon={<Plus size={17} />}
            label={copy.extraIncome}
            detail={formatCurrency(plan.extraIncomeTotal)}
            onClick={() => setExtraSheetOpen(true)}
          />
        </section>

        <section className="min-w-0" aria-labelledby="annual-plan-title">
          <header className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="annual-plan-title" className="text-lg font-semibold text-[var(--app-text)]">
                {copy.thisYear}
              </h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">{copy.annualSubtitle}</p>
            </div>
            <select
              value={annualYear}
              onChange={(event) => setAnnualYear(Number(event.target.value))}
              aria-label={t("money.year", language)}
              className="input-control h-10 w-auto min-w-24 py-0"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </header>
          <div className="mt-4 border-y border-[var(--app-border)] py-4">
            <MonthlyTrendChart
              language={language}
              moneySeries={annualMoneySeries}
              isCompactChart={isCompactChart}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-5 border-b border-[var(--app-border)] py-4 sm:grid-cols-4">
            <AnnualMetric label={copy.annualRecurring} value={annualExpenses} />
            <AnnualMetric label={copy.annualPaid} value={annualPaid} />
            <AnnualMetric label={copy.savedThisYear} value={annualSavingsActual} />
            <AnnualMetric label={copy.annualCapacity} value={annualCapacity} />
          </dl>
        </section>

        <section className="min-w-0" aria-labelledby="monthly-review-title">
          <header className="px-1">
            <h2 id="monthly-review-title" className="text-lg font-semibold text-[var(--app-text)]">
              {copy.monthlyReview}
            </h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">{copy.comparedWithPrevious}</p>
          </header>
          <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-3">
            <select
              value={reviewYear}
              onChange={(event) => selectReviewYear(Number(event.target.value))}
              aria-label={t("money.year", language)}
              className="input-control"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedSummary.id}
              onChange={(event) => {
                setSelectedMonthId(event.target.value);
                setExpandedReview(false);
              }}
              aria-label={t("money.month", language)}
              className="input-control capitalize"
            >
              {reviewMoneySeries.map((item) => (
                <option key={item.id} value={item.id}>{item.monthLong}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 px-1 text-xs font-semibold">
            <span className="rounded-full border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)]">
              {phaseLabel(selectedSummary.phase, copy)}
            </span>
            {selectedHasLegacyHistory ? (
              <span className="rounded-full border border-[var(--app-warning)] px-2 py-1 text-[var(--app-warning)]">
                {copy.legacyDerived}
              </span>
            ) : null}
          </div>

          <dl className="mt-4 divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
            <ReviewDelta label={copy.recurringExpenses} value={selectedSummary.expenses} previous={previousSummary.expenses} />
            <ReviewDelta label={copy.paid} value={selectedSummary.paid ?? 0} previous={previousSummary.paid ?? 0} />
            <ReviewDelta label={copy.actualSavings} value={selectedSummary.savings} previous={previousSummary.savings} />
            <ReviewDelta label={copy.freeAccordingToPlan} value={selectedSummary.remaining} previous={previousSummary.remaining} />
          </dl>

          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={salaryEditor.openEditor}>
              {copy.editFixedIncome}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openSavings(selectedSummary.id)}>
              {copy.editSavings}
            </Button>
          </div>

          <div className="mt-6 grid gap-6">
            <MonthlyIncomeEventsList
              language={language}
              incomeEvents={selectedIncomeEvents}
              onDeleteIncomeEvent={deleteIncomeEvent}
              onUpdateIncomeEvent={updateIncomeEvent}
            />
            <MonthlyExpenseBreakdown
              language={language}
              today={todayDateOnly}
              occurrences={selectedOccurrences}
              visibleOccurrences={visibleSelectedOccurrences}
              categories={store.categories}
              expanded={expandedReview}
              onToggleExpanded={() => setExpandedReview((value) => !value)}
              onSkipOccurrence={skipDialog.requestSkipOccurrence}
              onUpdateMonthlyExpense={updateMonthlyExpenseOccurrence}
            />
          </div>
        </section>
      </div>

      {settingsForm.settingsOpen ? (
        <PlanSettingsSheet
          language={language}
          salaryAmount={settingsForm.salaryAmount}
          salaryDay={settingsForm.salaryDay}
          dayPickerOpen={settingsForm.dayPickerOpen}
          onSalaryAmountChange={settingsForm.setSalaryAmount}
          onSalaryDayChange={settingsForm.setSalaryDay}
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
            <label className="mt-5 grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
              {copy.monthlyGoal}
              <input
                value={savingsTargetText}
                onChange={(event) => setSavingsTargetText(event.target.value)}
                inputMode="decimal"
                className="input-control"
              />
            </label>
            <label className="mt-3 grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
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

function EquationRow({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="font-medium text-[var(--app-text)]">{label}</dt>
        <dd className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{detail}</dd>
      </div>
      <dd className="app-money shrink-0 font-semibold text-[var(--app-text)]">
        {value < 0 ? "−" : ""}{formatCurrency(Math.abs(value))}
      </dd>
    </div>
  );
}

function PlanAction({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-focus-ring flex min-h-14 w-full items-center gap-3 border-y border-[var(--app-border)] px-1 text-left"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-accent)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--app-text)]">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--app-text-muted)]">{detail}</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-[var(--app-text-muted)]" />
    </button>
  );
}

function AnnualMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs font-medium text-[var(--app-text-muted)]">{label}</dt>
      <dd className="app-money mt-1 text-base font-semibold text-[var(--app-text)]">{formatCurrency(value)}</dd>
    </div>
  );
}

function ReviewDelta({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous: number;
}) {
  const delta = value - previous;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm font-medium text-[var(--app-text)]">{label}</dt>
      <dd className="text-right">
        <span className="app-money block font-semibold text-[var(--app-text)]">{formatCurrency(value)}</span>
        <span className="app-money mt-0.5 block text-xs text-[var(--app-text-muted)]">
          {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{formatCurrency(Math.abs(delta))}
        </span>
      </dd>
    </div>
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

function occurrencesForMonth(
  store: ExpenseStore,
  monthDate: Date,
  language: AppLanguage,
) {
  return generateStoreOccurrences(
    store,
    toDateOnly(startOfMonth(monthDate)),
    toDateOnly(endOfMonth(monthDate)),
    language,
  );
}

function buildSeriesItem(
  store: ExpenseStore,
  monthDate: Date,
  today: Date,
  language: AppLanguage,
): MoneySeriesItem {
  const locale = language === "en" ? enUS : es;
  const monthId = toDateOnly(startOfMonth(monthDate));
  const plan = buildMonthlyMoneyPlan({
    monthDate,
    finance: store.finance,
    occurrences: occurrencesForMonth(store, monthDate, language),
    today,
    includeExtraIncome: toMonthId(monthDate) <= toMonthId(today),
  });

  return {
    id: monthId,
    month: format(monthDate, "MMM", { locale }),
    monthLong: format(monthDate, "MMMM yyyy", { locale }),
    income: plan.plannedIncomeTotal,
    expenses: plan.expectedExpensesTotal,
    remaining: plan.freeAccordingToPlan,
    savings: plan.savingsActual,
    shortfall: plan.billsShortfall,
    hasRecords: true,
    phase: plan.phase,
    plannedExpenses: plan.plannedExpensesTotal,
    paid: plan.paidExpensesTotal,
    pending: plan.pendingExpensesTotal,
    savingsGoal: plan.savingsTarget,
    capacity: plan.maxSavingsCapacity,
  };
}

function getAvailableYears(store: ExpenseStore, today: Date) {
  const years = new Set<number>([today.getFullYear()]);
  store.templates.forEach((template) => years.add(Number(template.startDate.slice(0, 4))));
  store.finance.incomeEvents.forEach((event) => years.add(Number(event.receivedAt.slice(0, 4))));
  (store.occurrenceRecords ?? []).forEach((record) => years.add(Number(record.dueDate.slice(0, 4))));
  return Array.from(years).filter(Number.isFinite).sort((a, b) => b - a);
}

function formatShortDate(date: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function phaseLabel(
  phase: MoneySeriesItem["phase"],
  copy: ReturnType<typeof planCopy>,
) {
  if (phase === "projected") return copy.projected;
  if (phase === "current") return copy.current;
  return copy.registered;
}

function planCopy(language: AppLanguage) {
  if (language === "en") {
    return {
      toPay: "To pay",
      planFor: "Plan for",
      of: "of",
      paidReceipts: "receipts paid",
      noReceipts: "No recurring receipts this month.",
      paidProgress: "Paid receipts progress",
      overdue: "Overdue",
      nextReceipt: "Next receipt",
      allPaid: "Everything planned is paid",
      noUpcomingReceipt: "No upcoming receipt",
      monthEquation: "This month's plan",
      expectedIncome: "Expected income",
      fixedIncome: "Fixed",
      extras: "extras",
      expectedFinalExpenses: "Expected final recurring cost",
      paid: "Paid",
      pending: "pending",
      reservedSavings: "Reserved savings",
      goal: "Goal",
      actual: "Actual",
      freeAccordingToPlan: "Free according to plan",
      freeDisclaimer: "Full-month projection. It is not your bank balance and does not include small day-to-day spending.",
      missingForReceipts: "Missing for receipts:",
      unfundedGoal: "Savings goal not funded by this plan:",
      savingsThisMonth: "Savings this month",
      pendingReceipts: "Pending receipts",
      quickActions: "Plan actions",
      extraIncome: "Add one-off income",
      thisYear: "This year",
      annualSubtitle: "Twelve registered, current and projected months.",
      annualRecurring: "Planned recurring",
      annualPaid: "Paid recorded",
      savedThisYear: "Actually saved",
      annualCapacity: "Maximum capacity",
      monthlyReview: "Monthly review",
      comparedWithPrevious: "Compared with the previous calendar month.",
      legacyDerived: "Legacy-derived history",
      recurringExpenses: "Recurring expenses",
      actualSavings: "Actual savings",
      editFixedIncome: "Edit fixed income",
      editSavings: "Edit savings",
      monthlyGoal: "Monthly goal",
      actualTransfer: "Actual transfer",
      legacySavingDate: "Imported amount: transfer date was not recorded.",
      singleContribution: "There is one editable savings contribution per month. Enter 0 to remove it.",
      saveSavings: "Save savings",
      projected: "Projected",
      current: "Current month",
      registered: "Registered",
    };
  }

  return {
    toPay: "Por pagar",
    planFor: "Plan de",
    of: "de",
    paidReceipts: "recibos pagados",
    noReceipts: "Sin recibos recurrentes este mes.",
    paidProgress: "Progreso de recibos pagados",
    overdue: "Vencido",
    nextReceipt: "Próximo recibo",
    allPaid: "Todo lo previsto está pagado",
    noUpcomingReceipt: "No hay un próximo recibo",
    monthEquation: "Plan de este mes",
    expectedIncome: "Ingresos previstos",
    fixedIncome: "Fijo",
    extras: "extras",
    expectedFinalExpenses: "Gasto recurrente final previsto",
    paid: "Pagado",
    pending: "pendiente",
    reservedSavings: "Ahorro reservado",
    goal: "Objetivo",
    actual: "Real",
    freeAccordingToPlan: "Libre según el plan",
    freeDisclaimer: "Proyección del mes completo. No es el saldo bancario y no incluye los gastos pequeños del día a día.",
    missingForReceipts: "Faltan para pagar recibos:",
    unfundedGoal: "Objetivo de ahorro que este plan no financia:",
    savingsThisMonth: "Ahorro de este mes",
    pendingReceipts: "Recibos pendientes",
    quickActions: "Acciones del plan",
    extraIncome: "Añadir ingreso extra",
    thisYear: "Este año",
    annualSubtitle: "Doce meses registrados, actuales o proyectados.",
    annualRecurring: "Recurrente previsto",
    annualPaid: "Pagado registrado",
    savedThisYear: "Ahorrado real",
    annualCapacity: "Capacidad máxima",
    monthlyReview: "Revisión mensual",
    comparedWithPrevious: "Comparado con el mes natural anterior.",
    legacyDerived: "Histórico derivado",
    recurringExpenses: "Gastos recurrentes",
    actualSavings: "Ahorro real",
    editFixedIncome: "Editar ingreso fijo",
    editSavings: "Editar ahorro",
    monthlyGoal: "Objetivo mensual",
    actualTransfer: "Transferencia real",
    legacySavingDate: "Importe heredado: no se registró la fecha de transferencia.",
    singleContribution: "Hay una sola aportación editable por mes. Escribe 0 para eliminarla.",
    saveSavings: "Guardar ahorro",
    projected: "Proyectado",
    current: "Mes actual",
    registered: "Registrado",
  };
}
