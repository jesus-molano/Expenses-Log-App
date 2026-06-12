import {
  CircleDollarSign,
  Pencil,
  PiggyBank,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MoneyStat } from "./MoneyStat";
import type { MoneyStatTone } from "./MoneyStat";

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
  const remainingTone: MoneyStatTone =
    summary.shortfall > 0
      ? "danger"
      : summary.remaining > 0
        ? "success"
        : "neutral";

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <MoneyStat
        label={t("money.income", language)}
        value={formatCurrency(summary.income)}
        icon={<CircleDollarSign />}
        tone="info"
        action={
          canEditSalary ? (
            <IconButton
              type="button"
              onClick={onEditSalary}
              aria-label={t("money.editMonthSalary", language)}
              title={t("money.editMonthSalary", language)}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <Pencil size={13} />
            </IconButton>
          ) : null
        }
      />
      <MoneyStat
        label={t("money.fixedExpenses", language)}
        value={formatCurrency(summary.expenses)}
        icon={<ReceiptText />}
        tone="expense"
      />
      <MoneyStat
        label={t("money.savings", language)}
        value={formatCurrency(summary.savings)}
        icon={<PiggyBank />}
        tone="success"
        action={
          canEditSavings ? (
            <IconButton
              type="button"
              onClick={onEditSavings}
              aria-label={t("money.editMonthSavings", language)}
              title={t("money.editMonthSavings", language)}
              variant="ghost"
              size="sm"
              className="shrink-0"
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
        icon={<Wallet />}
        tone={remainingTone}
      />
    </div>
  );
}
