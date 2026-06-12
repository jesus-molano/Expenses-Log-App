"use client";

import { Settings2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PlanHeaderProps = {
  language: AppLanguage;
  onOpenSettings: () => void;
};

export function PlanHeader({
  language,
  onOpenSettings,
}: PlanHeaderProps) {
  return (
    <div className="relative min-w-0 pr-12">
      <div className="min-w-0 py-1">
        <h1 className="text-xl font-semibold text-[var(--app-text)]">
          {t("money.monthlyPlan", language)}
        </h1>
      </div>
      <IconButton
        type="button"
        onClick={onOpenSettings}
        aria-label={t("money.configure", language)}
        title={t("money.configure", language)}
        size="md"
        className="absolute right-0 top-1/2 shrink-0 -translate-y-1/2"
      >
        <Settings2 size={17} />
      </IconButton>
    </div>
  );
}
