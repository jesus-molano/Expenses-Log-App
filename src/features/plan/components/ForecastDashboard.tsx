"use client";

import { formatCurrency } from "@/domain/calendar";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useActiveBudgetMonth } from "../hooks/use-active-budget-month";
import { useAnnualPlan } from "../hooks/use-annual-plan";
import { useCompactChart } from "../hooks/use-compact-chart";
import { usePlanInsights } from "../hooks/use-plan-insights";
import { AnnualPlanSection } from "./AnnualPlanSection";
import { RecurringCostSection } from "./RecurringCostSection";
import { UpcomingBillsSection } from "./UpcomingBillsSection";

// Pestaña Previsión (/forecast): lo que viene desde el mes activo (recibos
// grandes y cuánto apartar al mes), el coste por categoría y el plan anual.
export function ForecastDashboard() {
  const { store } = useExpenseStore();
  const chrome = useScrollChrome();
  const isCompactChart = useCompactChart();
  const { language, today, todayDateOnly, activeMonthId, cycle } = useActiveBudgetMonth(store);
  const insights = usePlanInsights({
    store,
    monthId: activeMonthId,
    cycle,
    today: todayDateOnly,
    language,
  });
  const annual = useAnnualPlan({ store, today, language, activeMonthId, cycle });

  return (
    <DashboardShell
      headlineLabel={formatCurrency(insights.provision.monthlyToSetAside)}
      headlineTitle={t("insights.provision.headlineTitle", language)}
      activeTab="forecast"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <div className="grid w-full min-w-0 gap-10 overflow-hidden pb-8 pt-1 sm:gap-12">
        <h1 className="sr-only">{t("common.forecast", language)}</h1>
        <UpcomingBillsSection
          language={language}
          largeBills={insights.largeBills.items}
          largeBillsTotal={insights.largeBills.total}
          provision={insights.provision}
        />
        <RecurringCostSection language={language} insights={insights.costs} />
        <AnnualPlanSection
          language={language}
          year={annual.year}
          availableYears={annual.availableYears}
          moneySeries={annual.moneySeries}
          isCompactChart={isCompactChart}
          annualExpenses={annual.totals.expenses}
          annualPaid={annual.totals.paid}
          annualSavingsActual={annual.totals.savings}
          annualCapacity={annual.totals.capacity}
          onYearChange={annual.selectYear}
        />
      </div>
    </DashboardShell>
  );
}
