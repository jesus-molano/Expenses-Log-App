"use client";

import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PlanSettingsHeaderProps = {
  language: AppLanguage;
  onClose: () => void;
};

export function PlanSettingsHeader({
  language,
  onClose,
}: PlanSettingsHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[var(--app-text)]">
          {t("money.configureMoney", language)}
        </h2>
        <p className="text-sm text-[var(--app-text-muted)]">
          {t("money.configureMoneySubtitle", language)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="h-10 rounded-full px-3 text-sm font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-panel-soft-alpha)]"
      >
        {t("money.close", language)}
      </button>
    </header>
  );
}
