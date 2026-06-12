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

type MonthlyTrendChartProps = {
  language: AppLanguage;
  moneySeries: MoneySeriesItem[];
  isCompactChart: boolean;
};

export function MonthlyTrendChart({
  language,
  moneySeries,
  isCompactChart,
}: MonthlyTrendChartProps) {
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[var(--app-text-muted)]">
        <ChartLegendItem color="var(--app-chart-income)" label={t("money.income", language)} />
        <ChartLegendItem color="var(--app-chart-expenses)" label={t("money.fixedExpenses", language)} />
        <ChartLegendItem color="var(--app-chart-free)" label={t("money.free", language)} />
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
              dataKey="remaining"
              name={t("money.free", language)}
              fill="var(--app-chart-free)"
              radius={[8, 8, 2, 2]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function compactMoneyAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(Math.round(value));
}
