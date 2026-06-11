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
    <section className="min-w-0 overflow-hidden rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-panel-alpha)] p-3 sm:p-4">
      <header>
        <h2 className="text-lg font-semibold text-[var(--app-text)]">
          {t("money.trendTitle", language)}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("money.trendSubtitle", language)}
        </p>
      </header>

      <MonthlyTrendChart
        language={language}
        moneySeries={moneySeries}
        isCompactChart={isCompactChart}
      />

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
