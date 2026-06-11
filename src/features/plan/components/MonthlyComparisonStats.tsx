"use client";

import { Pencil } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MoneyStat } from "./MoneyStat";

type MonthlyComparisonStatsProps = {
  language: AppLanguage;
  summary: MoneySeriesItem;
  canEditSavings: boolean;
  onEditSavings: () => void;
};

export function MonthlyComparisonStats({
  language,
  summary,
  canEditSavings,
  onEditSavings,
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
        action={
          canEditSavings ? (
            <button
              type="button"
              onClick={onEditSavings}
              aria-label={t("money.editMonthSavings", language)}
              title={t("money.editMonthSavings", language)}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] transition hover:text-[var(--app-text)]"
            >
              <Pencil size={13} />
            </button>
          ) : null
        }
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
