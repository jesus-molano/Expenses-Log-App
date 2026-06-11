"use client";

import { useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { t } from "@/shared/i18n";
import { useMoneyDashboardData } from "../hooks/use-money-dashboard-data";
import { useMonthlySavingsTargetEditor } from "../hooks/use-monthly-savings-target-editor";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { AccountAllocationCards } from "./AccountAllocationCards";
import { MonthlyComparisonSection } from "./MonthlyComparisonSection";
import { MonthlySavingsTargetDialog } from "./MonthlySavingsTargetDialog";
import { MonthlyTrendSection } from "./MonthlyTrendSection";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanAnalyticsDivider } from "./PlanAnalyticsDivider";
import { PlanHeader } from "./PlanHeader";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { PlanShortfallBanner } from "./PlanShortfallBanner";
import { PlanSummaryStats } from "./PlanSummaryStats";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";

export function MoneyDashboard() {
  const {
    store,
    updateMoneySettings,
    updateMonthlySavingsTarget,
    addIncomeEvent,
    deleteIncomeEvent,
    skipOccurrence,
  } = useExpenseStore();
  const chrome = useScrollChrome();

  const language = store.preferences?.language ?? "es";
  const money = useMoneyDashboardData(store, language);
  const settingsForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    savingsMonthId: money.currentMonthId,
    onSave: updateMoneySettings,
  });
  const oneOffIncome = useOneOffIncomeForm({
    today: money.todayDateOnly,
    onAddIncome: addIncomeEvent,
  });
  const skipDialog = useSkipOccurrenceConfirmation(skipOccurrence);
  const savingsEditor = useMonthlySavingsTargetEditor({
    finance: store.finance,
    language,
    monthId: money.selectedMonthSummary.id,
    monthLabel: money.selectedMonthSummary.monthLong,
    onSave: updateMonthlySavingsTarget,
  });
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);

  return (
    <DashboardShell
      headlineLabel={formatCurrency(money.plan.primaryContribution)}
      headlineTitle={
        money.plan.shortfall > 0
          ? t("common.shortfall", language)
          : t("common.freeThisMonth", language)
      }
      activeTab="money"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden pb-8 pt-2">
        <PlanHeader
          language={language}
          onOpenSettings={settingsForm.openSettings}
        />

        <PlanSummaryStats
          language={language}
          incomeTotal={money.plan.incomeTotal}
          fixedExpensesTotal={money.plan.fixedExpensesTotal}
          savingsContribution={money.plan.savingsContribution}
          primaryContribution={money.plan.primaryContribution}
        />

        <AccountAllocationCards
          language={language}
          expensesAccountName={store.finance.allocation.expensesAccountName}
          savingsAccountName={store.finance.allocation.savingsAccountName}
          primaryAccountName={store.finance.allocation.primaryAccountName}
          expensesContribution={money.plan.expensesContribution}
          fixedExpensesTotal={money.plan.fixedExpensesTotal}
          savingsContribution={money.plan.savingsContribution}
          monthlySavingsTarget={money.currentMonthSavingsTarget}
          primaryContribution={money.plan.primaryContribution}
        />

        <PlanShortfallBanner
          language={language}
          shortfall={money.plan.shortfall}
        />

        <OneOffIncomePanel
          language={language}
          extraIncomeTotal={money.plan.extraIncomeTotal}
          incomeEvents={money.monthlyIncomeEvents}
          extraName={oneOffIncome.extraName}
          extraAmount={oneOffIncome.extraAmount}
          onExtraNameChange={oneOffIncome.setExtraName}
          onExtraAmountChange={oneOffIncome.setExtraAmount}
          onSubmit={oneOffIncome.saveExtra}
          onDeleteIncomeEvent={deleteIncomeEvent}
        />

        <PlanAnalyticsDivider language={language} />

        <MonthlyTrendSection
          language={language}
          moneySeries={money.moneySeries}
          isCompactChart={money.isCompactChart}
          annualExpensesTotalLabel={money.annualExpensesTotalLabel}
          annualSavingsEstimateLabel={money.annualSavingsEstimateLabel}
        />

        <MonthlyComparisonSection
          language={language}
          today={money.todayDateOnly}
          moneySeries={money.moneySeries}
          availableYears={money.availableYears}
          selectedYear={money.selectedYear}
          selectedMonthSummary={money.selectedMonthSummary}
          selectedMonthIsPast={money.selectedMonthIsPast}
          yearMenuOpen={yearMenuOpen}
          monthMenuOpen={monthMenuOpen}
          incomeEvents={money.selectedMonthIncomeEvents}
          occurrences={money.selectedMonthOccurrences}
          visibleOccurrences={money.visibleSelectedMonthOccurrences}
          categories={store.categories}
          expanded={money.selectedExpensesExpanded}
          onYearOpenChange={setYearMenuOpen}
          onMonthOpenChange={setMonthMenuOpen}
          onSelectYear={money.selectYear}
          onSelectMonth={money.selectMonth}
          onEditSavings={savingsEditor.openEditor}
          onToggleExpanded={() =>
            money.setSelectedExpensesExpanded((expanded) => !expanded)
          }
          onDeleteIncomeEvent={deleteIncomeEvent}
          onSkipOccurrence={skipDialog.requestSkipOccurrence}
        />
      </section>

      {settingsForm.settingsOpen ? (
        <PlanSettingsSheet
          language={language}
          salaryAmount={settingsForm.salaryAmount}
          salaryDay={settingsForm.salaryDay}
          savingsTarget={settingsForm.savingsTarget}
          accountNames={settingsForm.accountNames}
          dayPickerOpen={settingsForm.dayPickerOpen}
          onSalaryAmountChange={settingsForm.setSalaryAmount}
          onSalaryDayChange={settingsForm.setSalaryDay}
          onSavingsTargetChange={settingsForm.setSavingsTarget}
          onAccountNamesChange={settingsForm.setAccountNames}
          onDayPickerOpenChange={settingsForm.setDayPickerOpen}
          onClose={settingsForm.closeSettings}
          onSubmit={settingsForm.submitSettings}
        />
      ) : null}

      {savingsEditor.open ? (
        <MonthlySavingsTargetDialog
          language={language}
          monthLabel={savingsEditor.monthLabel}
          amount={savingsEditor.amount}
          onAmountChange={savingsEditor.setAmount}
          onClose={savingsEditor.closeEditor}
          onSubmit={savingsEditor.submit}
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

