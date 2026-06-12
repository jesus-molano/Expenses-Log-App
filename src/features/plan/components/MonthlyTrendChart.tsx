"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
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
      <div className="app-chart-legend mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold">
        <ChartLegendItem color="var(--app-chart-income)" label={t("money.income", language)} />
        <ChartLegendItem color="var(--app-chart-expenses)" label={t("money.fixedExpenses", language)} />
        <ChartLegendItem color="var(--app-chart-free)" label={t("money.free", language)} />
      </div>
      <div className="app-chart-shell mt-4 h-48 min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={moneySeries}
            barGap={isCompactChart ? 2 : 4}
            barCategoryGap={isCompactChart ? "24%" : "32%"}
            margin={
              isCompactChart
                ? { top: 12, right: 2, bottom: 0, left: 2 }
                : { top: 12, right: 6, bottom: 0, left: 4 }
            }
          >
            <defs>
              <linearGradient id="chartIncomeGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--app-chart-income)" stopOpacity={0.96} />
                <stop offset="100%" stopColor="var(--app-chart-income)" stopOpacity={0.46} />
              </linearGradient>
              <linearGradient id="chartExpensesGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--app-chart-expenses)" stopOpacity={0.94} />
                <stop offset="100%" stopColor="var(--app-chart-expenses)" stopOpacity={0.42} />
              </linearGradient>
              <linearGradient id="chartFreeGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--app-chart-free)" stopOpacity={0.96} />
                <stop offset="100%" stopColor="var(--app-chart-free)" stopOpacity={0.44} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--app-border) 68%, transparent)"
              strokeDasharray="2 8"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--app-text-muted)", fontSize: 11, fontWeight: 600 }}
              tickMargin={8}
            />
            {isCompactChart ? null : (
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--app-text-muted)", fontSize: 11, fontWeight: 600 }}
                tickFormatter={(value) => compactMoneyAxis(Number(value))}
                width={48}
              />
            )}
            <ReferenceLine
              y={0}
              stroke="color-mix(in srgb, var(--app-border-strong) 70%, transparent)"
              strokeWidth={1}
            />
            <Tooltip
              cursor={{
                fill: "color-mix(in srgb, var(--app-accent) 7%, transparent)",
                radius: 12,
              }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="income"
              name={t("money.income", language)}
              fill="url(#chartIncomeGradient)"
              maxBarSize={18}
              radius={[7, 7, 2, 2]}
            />
            <Bar
              dataKey="expenses"
              name={t("money.fixedExpenses", language)}
              fill="url(#chartExpensesGradient)"
              maxBarSize={18}
              radius={[7, 7, 2, 2]}
            />
            <Bar
              dataKey="remaining"
              name={t("money.free", language)}
              fill="url(#chartFreeGradient)"
              maxBarSize={18}
              radius={[7, 7, 2, 2]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 12%, transparent)`,
        }}
      />
      {label}
    </span>
  );
}

type ChartTooltipPayload = {
  color?: string;
  name?: string;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayload[];
};

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="app-chart-tooltip">
      <p className="text-xs font-semibold uppercase text-[var(--app-text-subtle)]">
        {label}
      </p>
      <div className="mt-2 grid gap-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="app-chart-tooltip-row">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="min-w-0 truncate">{entry.name}</span>
            </span>
            <span className="font-semibold text-[var(--app-text)]">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function compactMoneyAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(Math.round(value));
}
