"use client";

import { Pencil, RotateCcw } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type SwipeActionsLayerProps = {
  direction: "left" | "right" | null;
  paid: boolean;
  language: AppLanguage;
};

export function SwipeActionsLayer({
  direction,
  paid,
  language,
}: SwipeActionsLayerProps) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden rounded-[var(--app-radius-md)] transition-opacity duration-200 ${
        direction ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`app-swipe-edit absolute inset-y-0 left-0 flex w-[52%] items-center gap-1 rounded-l-[var(--app-radius-md)] px-4 text-xs font-semibold transition ${
          direction === "right" ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
        }`}
      >
        <Pencil size={16} />
        {t("common.edit", language)}
      </div>
      <div
        className={`app-swipe-paid absolute inset-y-0 right-0 flex w-[52%] items-center justify-end gap-1 rounded-r-[var(--app-radius-md)] px-4 text-xs font-semibold transition ${
          direction === "left" ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
        }`}
      >
        <RotateCcw size={16} />
        {paid ? t("common.pending", language) : t("common.paid", language)}
      </div>
    </div>
  );
}
