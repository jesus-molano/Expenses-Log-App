"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MoneyStat } from "./PlanCards";

type MonthlyTrendSectionProps = {
  language: AppLanguage;
  moneySeries: MoneySeriesItem[];
  isCompactChart: boolean;
  annualExpensesTotalLabel: string;
  annualSavingsEstimateLabel: string;
};

export function MonthlyTrendSection({
  language,
  moneySeries,
  isCompactChart,
  annualExpensesTotalLabel,
  annualSavingsEstimateLabel,
}: MonthlyTrendSectionProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-panel-alpha)] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--app-text)]">
            {t("money.trendTitle", language)}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {t("money.trendSubtitle", language)}
          </p>
        </div>
      </div>
      <div className="mt-4 h-44 min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={moneySeries}
            margin={
              isCompactChart
                ? { top: 4, right: 2, bottom: 0, left: 2 }
                : { top: 4, right: 4, bottom: 0, left: 4 }
            }
          >
            <CartesianGrid
              stroke="var(--app-border)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--app-text-muted)", fontSize: 12 }}
            />
            {isCompactChart ? null : (
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--app-text-muted)", fontSize: 11 }}
                tickFormatter={(value) => compactMoneyAxis(Number(value))}
                width={48}
              />
            )}
            <Tooltip
              cursor={{ fill: "var(--app-panel-soft-alpha)" }}
              contentStyle={{
                background: "var(--app-surface)",
                border: "1px solid var(--app-border)",
                borderRadius: "14px",
                color: "var(--app-text)",
              }}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                String(name),
              ]}
            />
            <Bar
              dataKey="income"
              name={t("money.income", language)}
              fill="var(--app-chart-income)"
              radius={[8, 8, 2, 2]}
            />
            <Bar
              dataKey="expenses"
              name={t("money.fixedExpenses", language)}
              fill="var(--app-chart-expenses)"
              radius={[8, 8, 2, 2]}
            />
            <Bar
              dataKey="free"
              name={t("money.free", language)}
              fill="var(--app-chart-free)"
              radius={[8, 8, 2, 2]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MoneyStat
          label={t("money.annualExpenses", language)}
          value={annualExpensesTotalLabel}
        />
        <MoneyStat
          label={t("money.annualSavingsEstimate", language)}
          value={annualSavingsEstimateLabel}
        />
      </div>
    </section>
  );
}

function compactMoneyAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(Math.round(value));
}

