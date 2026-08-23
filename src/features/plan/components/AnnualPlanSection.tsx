"use client";

import dynamic from "next/dynamic";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { planCopy } from "../lib/plan-dashboard";
import type { MoneySeriesItem } from "../types";

const MonthlyTrendChart = dynamic(() =>
  import("./MonthlyTrendChart").then((module) => module.MonthlyTrendChart),
);

export function AnnualPlanSection({
  language,
  copy,
  year,
  availableYears,
  moneySeries,
  isCompactChart,
  annualExpenses,
  annualPaid,
  annualSavingsActual,
  annualCapacity,
  onYearChange,
}: {
  language: AppLanguage;
  copy: ReturnType<typeof planCopy>;
  year: number;
  availableYears: number[];
  moneySeries: MoneySeriesItem[];
  isCompactChart: boolean;
  annualExpenses: number;
  annualPaid: number;
  annualSavingsActual: number;
  annualCapacity: number;
  onYearChange: (year: number) => void;
}) {
  return (
    <section className="min-w-0" aria-labelledby="annual-plan-title">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2
            id="annual-plan-title"
            className="app-plan-section-title text-[var(--app-text)]"
          >
            {copy.annualPlan}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {copy.annualSubtitle}
          </p>
        </div>
        <select
          value={year}
          onChange={(event) => onYearChange(Number(event.target.value))}
          aria-label={t("money.year", language)}
          className="input-control h-10 w-auto min-w-24 py-0"
        >
          {availableYears.map((availableYear) => (
            <option key={availableYear} value={availableYear}>
              {availableYear}
            </option>
          ))}
        </select>
      </header>
      <div className="mt-4">
        <MonthlyTrendChart
          language={language}
          moneySeries={moneySeries}
          isCompactChart={isCompactChart}
        />
      </div>
      <dl className="app-plan-metric-grid mt-4 grid grid-cols-2 gap-x-5 rounded-[var(--app-radius-lg)] px-3 py-3 sm:grid-cols-4">
        <AnnualMetric label={copy.annualRecurring} value={annualExpenses} />
        <AnnualMetric label={copy.annualPaid} value={annualPaid} />
        <AnnualMetric
          label={copy.savedThisYear}
          value={annualSavingsActual}
        />
        <AnnualMetric label={copy.annualCapacity} value={annualCapacity} />
      </dl>
    </section>
  );
}

function AnnualMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 py-1.5">
      <dt className="text-xs font-medium text-[var(--app-text-muted)]">
        {label}
      </dt>
      <dd className="app-money mt-1 text-base font-semibold text-[var(--app-text)]">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
