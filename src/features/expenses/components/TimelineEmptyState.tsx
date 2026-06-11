"use client";

import { Home } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type TimelineEmptyStateProps = {
  language: AppLanguage;
};

export function TimelineEmptyState({ language }: TimelineEmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.04] px-6 py-14 text-center">
      <Home size={32} className="text-slate-500" />
      <p className="mt-3 font-semibold text-white">
        {t("expenses.emptyTitle", language)}
      </p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        {t("expenses.emptyBody", language)}
      </p>
    </div>
  );
}
