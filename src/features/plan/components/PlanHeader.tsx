"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <div className="relative min-w-0 pr-14">
      <div className="min-w-0 py-1">
        <h1 className="text-xl font-semibold text-[var(--app-text)]">
          {t("money.monthlyPlan", language)}
        </h1>
      </div>
      <Button
        type="button"
        onClick={onOpenSettings}
        aria-label={t("money.configure", language)}
        variant="secondary"
        className="absolute right-0 top-1/2 shrink-0 -translate-y-1/2 sm:px-4"
        leadingIcon={<Settings2 size={17} />}
      >
        <span className="hidden sm:inline">{t("money.configure", language)}</span>
      </Button>
    </div>
  );
}
