"use client";

import { useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { t } from "@/shared/i18n";
import { useMoneyDashboardData } from "../hooks/use-money-dashboard-data";
import { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { useSkipOccurrenceConfirmation } from "../hooks/use-skip-occurrence-confirmation";
import { AccountAllocationCards } from "./AccountAllocationCards";
import { MonthlyComparisonSection } from "./MonthlyComparisonSection";
import { MonthlyTrendSection } from "./MonthlyTrendSection";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanHeader } from "./PlanHeader";
import { PlanSettingsSheet } from "./PlanSettingsSheet";
import { PlanShortfallBanner } from "./PlanShortfallBanner";
import { SkipOccurrenceDialog } from "./SkipOccurrenceDialog";

export function MoneyDashboard() {
  const {
    store,
    updateMoneySettings,
    addIncomeEvent,
    deleteIncomeEvent,
    skipOccurrence,
  } = useExpenseStore();
  useScrollChrome();

  const language = store.preferences?.language ?? "es";
  const money = useMoneyDashboardData(store, language);
  const settingsForm = usePlanSettingsForm({
    finance: store.finance,
    language,
    onSave: updateMoneySettings,
  });
  const oneOffIncome = useOneOffIncomeForm({
    today: money.todayDateOnly,
    onAddIncome: addIncomeEvent,
  });
  const skipDialog = useSkipOccurrenceConfirmation(skipOccurrence);
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
    >
      <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden pb-8 pt-2">
        <PlanHeader
          language={language}
          incomeTotal={money.plan.incomeTotal}
          onOpenSettings={settingsForm.openSettings}
        />

        <AccountAllocationCards
          language={language}
          expensesAccountName={store.finance.allocation.expensesAccountName}
          savingsAccountName={store.finance.allocation.savingsAccountName}
          primaryAccountName={store.finance.allocation.primaryAccountName}
          expensesContribution={money.plan.expensesContribution}
          fixedExpensesTotal={money.plan.fixedExpensesTotal}
          savingsContribution={money.plan.savingsContribution}
          monthlySavingsTarget={store.finance.allocation.monthlySavingsTarget}
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

      <SkipOccurrenceDialog
        occurrence={skipDialog.occurrenceToSkip}
        language={language}
        onCancel={skipDialog.cancelSkipOccurrence}
        onConfirm={skipDialog.confirmSkipOccurrence}
      />
    </DashboardShell>
  );
}

function PlanAnalyticsDivider({ language }: { language: AppLanguage }) {
  return (
    <div className="my-2 flex items-center gap-3 px-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--app-border)] to-transparent" />
      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft-alpha)] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
        {t("money.analytics", language)}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--app-border)] to-transparent" />
    </div>
  );
}



