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
    <section className="min-w-0 overflow-hidden rounded-[1.35rem] border border-[color-mix(in_srgb,var(--app-border)_72%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-alpha)_78%,transparent)] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.16)] sm:p-4">
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
