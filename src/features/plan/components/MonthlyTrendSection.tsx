import { PiggyBank, ReceiptText } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { MoneyStat } from "./MoneyStat";

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
    <section className="grid min-w-0 gap-4">
      <header className="px-1">
        <h2 className="text-lg font-semibold text-[var(--app-text)]">
          {t("money.trendTitle", language)}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("money.trendSubtitle", language)}
        </p>
      </header>

      <div className="app-section-card min-w-0 p-4">
        <MonthlyTrendChart
          language={language}
          moneySeries={moneySeries}
          isCompactChart={isCompactChart}
        />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MoneyStat
            label={t("money.annualExpenses", language)}
            value={annualExpensesTotalLabel}
            icon={<ReceiptText />}
            tone="expense"
          />
          <MoneyStat
            label={t("money.annualSavingsEstimate", language)}
            value={annualSavingsEstimateLabel}
            icon={<PiggyBank />}
            tone="success"
          />
        </div>
      </div>
    </section>
  );
}
