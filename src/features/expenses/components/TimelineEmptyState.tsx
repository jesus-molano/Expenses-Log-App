"use client";

import { Home } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type TimelineEmptyStateProps = {
  language: AppLanguage;
};

export function TimelineEmptyState({ language }: TimelineEmptyStateProps) {
  return (
    <div className="app-empty-line grid place-items-center border-dashed px-6 py-14 text-center">
      <Home size={32} className="text-[var(--app-text-subtle)]" />
      <p className="mt-3 font-semibold text-[var(--app-text)]">
        {t("expenses.emptyTitle", language)}
      </p>
      <p className="mt-1 max-w-xs text-sm text-[var(--app-text-muted)]">
        {t("expenses.emptyBody", language)}
      </p>
    </div>
  );
}
