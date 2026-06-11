"use client";

import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MoneyStat } from "./PlanCards";

type MonthlyComparisonStatsProps = {
  language: AppLanguage;
  summary: MoneySeriesItem;
};

export function MonthlyComparisonStats({
  language,
  summary,
}: MonthlyComparisonStatsProps) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(summary.income)}
      />
      <MoneyStat
        label={t("money.fixedExpenses", language)}
        value={formatCurrency(summary.expenses)}
      />
      <MoneyStat
        label={t("money.savings", language)}
        value={formatCurrency(summary.savings)}
      />
      <MoneyStat
        label={
          summary.shortfall > 0
            ? t("common.shortfall", language)
            : t("money.free", language)
        }
        value={formatCurrency(
          summary.shortfall > 0 ? summary.shortfall : summary.free,
        )}
      />
    </div>
  );
}
