"use client";

import { Repeat } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type RecurringOverviewButtonProps = {
  language: AppLanguage;
  onClick: () => void;
};

export function RecurringOverviewButton({
  language,
  onClick,
}: RecurringOverviewButtonProps) {
  return (
    <IconButton
      type="button"
      onClick={onClick}
      aria-label={t("expenses.recurring", language)}
      className="relative shrink-0 rounded-full"
    >
      <Repeat size={18} />
    </IconButton>
  );
}
