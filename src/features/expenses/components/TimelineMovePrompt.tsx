"use client";

import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";
import { Button } from "@/components/ui/Button";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";

type TimelineMovePromptProps = {
  pendingMove: {
    occurrence: ExpenseOccurrence;
    dueDate: string;
  } | null;
  language: AppLanguage;
  locale: Locale;
  onApplySeries: () => void;
  onClose: () => void;
};

export function TimelineMovePrompt({
  pendingMove,
  language,
  locale,
  onApplySeries,
  onClose,
}: TimelineMovePromptProps) {
  if (!pendingMove) return null;

  return (
    <div className="app-dialog fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto p-3">
      <p className="text-sm font-semibold">
        {t("expenses.moved", language)}{" "}
        {pendingMove.occurrence.template.name}{" "}
        {format(parseISO(pendingMove.dueDate), "d MMMM", { locale })}
      </p>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {t("expenses.movedDetail", language)}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          onClick={onApplySeries}
          variant="primary"
        >
          {t("expenses.thisAndNext", language)}
        </Button>
        <Button
          type="button"
          onClick={onClose}
          variant="secondary"
        >
          {t("common.ok", language)}
        </Button>
      </div>
    </div>
  );
}
