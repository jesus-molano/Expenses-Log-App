"use client";

import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

export function PlanAnalyticsDivider({ language }: { language: AppLanguage }) {
  return (
    <div className="my-2 flex items-center gap-3 px-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--app-border)] to-transparent" />
      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft-alpha)] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
        {t("money.analytics", language)}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--app-border)] to-transparent" />
    </div>
  );
}
