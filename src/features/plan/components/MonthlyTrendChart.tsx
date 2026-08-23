"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
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
  const { containerRef, ready } = useMeasuredChartContainer();

  return (
    <>
      <div className="app-chart-legend mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold">
        <ChartLegendItem
          color="var(--app-chart-expenses)"
          label={t("money.fixedExpenses", language)}
        />
        <ChartLegendItem
          color="var(--app-chart-savings)"
          label={language === "es" ? "Ahorro real" : "Actual savings"}
        />
        <ChartLegendItem
          color="var(--app-chart-capacity)"
          label={language === "es" ? "Capacidad máxima" : "Maximum capacity"}
        />
      </div>
      <div
        ref={containerRef}
        role="img"
        aria-label={
          language === "es"
            ? "Comparación mensual de gastos recurrentes, ahorro real y capacidad máxima"
            : "Monthly comparison of recurring expenses, actual savings and maximum capacity"
        }
        className="app-chart-shell mt-4 h-52 min-h-52 min-w-0 overflow-hidden"
      >
        {ready ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              data={moneySeries}
              barGap={isCompactChart ? 2 : 4}
              barCategoryGap={isCompactChart ? "24%" : "32%"}
              margin={
                isCompactChart
                  ? { top: 12, right: 2, bottom: 12, left: 2 }
                  : { top: 12, right: 6, bottom: 12, left: 4 }
              }
            >
              <defs>
                <linearGradient
                  id="chartExpensesGradient"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--app-chart-expenses)"
                    stopOpacity={0.94}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--app-chart-expenses)"
                    stopOpacity={0.42}
                  />
                </linearGradient>
                <linearGradient
                  id="chartSavingsGradient"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--app-chart-savings)"
                    stopOpacity={0.96}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--app-chart-savings)"
                    stopOpacity={0.44}
                  />
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
                tick={{
                  fill: "var(--app-text-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
                height={28}
                interval={isCompactChart ? 1 : 0}
                minTickGap={0}
                tickMargin={8}
              />
              {isCompactChart ? null : (
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "var(--app-text-muted)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
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
                dataKey="expenses"
                name={t("money.fixedExpenses", language)}
                fill="url(#chartExpensesGradient)"
                maxBarSize={18}
                radius={[7, 7, 2, 2]}
              />
              <Bar
                dataKey="savings"
                name={language === "es" ? "Ahorro real" : "Actual savings"}
                fill="url(#chartSavingsGradient)"
                maxBarSize={18}
                radius={[7, 7, 2, 2]}
              />
              <Line
                type="monotone"
                dataKey="capacity"
                name={language === "es" ? "Capacidad máxima" : "Maximum capacity"}
                stroke="var(--app-chart-capacity)"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </>
  );
}

function useMeasuredChartContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observedElement = element;

    function update() {
      const rect = observedElement.getBoundingClientRect();
      setReady(rect.width > 0 && rect.height > 0);
    }

    update();
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(observedElement);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { containerRef, ready };
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
            <span className="app-money font-semibold text-[var(--app-text)]">
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
