"use client";

import { Pencil } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MoneyStat } from "./MoneyStat";

type MonthlyComparisonStatsProps = {
  language: AppLanguage;
  summary: MoneySeriesItem;
  canEditSalary: boolean;
  canEditSavings: boolean;
  onEditSalary: () => void;
  onEditSavings: () => void;
};

export function MonthlyComparisonStats({
  language,
  summary,
  canEditSalary,
  canEditSavings,
  onEditSalary,
  onEditSavings,
}: MonthlyComparisonStatsProps) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(summary.income)}
        action={
          canEditSalary ? (
            <IconButton
              type="button"
              onClick={onEditSalary}
              aria-label={t("money.editMonthSalary", language)}
              title={t("money.editMonthSalary", language)}
              size="sm"
              className="size-7 min-h-7 min-w-7 shrink-0"
            >
              <Pencil size={13} />
            </IconButton>
          ) : null
        }
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
            <IconButton
              type="button"
              onClick={onEditSavings}
              aria-label={t("money.editMonthSavings", language)}
              title={t("money.editMonthSavings", language)}
              size="sm"
              className="size-7 min-h-7 min-w-7 shrink-0"
            >
              <Pencil size={13} />
            </IconButton>
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
          summary.shortfall > 0 ? summary.shortfall : summary.remaining,
        )}
      />
    </div>
  );
}
