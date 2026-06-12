import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PlanShortfallBannerProps = {
  language: AppLanguage;
  shortfall: number;
};

export function PlanShortfallBanner({
  language,
  shortfall,
}: PlanShortfallBannerProps) {
  if (shortfall <= 0) return null;

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-warning)_14%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--app-warning)]">
      {t("common.shortfall", language)} {formatCurrency(shortfall)}{" "}
      {t("money.shortfallMessage", language)}
    </div>
  );
}
