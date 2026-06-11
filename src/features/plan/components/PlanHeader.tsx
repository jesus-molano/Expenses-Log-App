"use client";

import { Settings2 } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PlanHeaderProps = {
  language: AppLanguage;
  incomeTotal: number;
  onOpenSettings: () => void;
};

export function PlanHeader({
  language,
  incomeTotal,
  onOpenSettings,
}: PlanHeaderProps) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--app-text-muted)]">
          {t("money.income", language)} {formatCurrency(incomeTotal)}
        </p>
        <h1 className="text-xl font-semibold text-[var(--app-text)]">
          {t("money.monthlyPlan", language)}
        </h1>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label={t("money.configure", language)}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)] sm:px-4"
      >
        <Settings2 size={17} />
        <span className="hidden sm:inline">{t("money.configure", language)}</span>
      </button>
    </div>
  );
}
