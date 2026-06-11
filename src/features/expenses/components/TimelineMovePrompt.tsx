"use client";

import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";
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
    <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[1.35rem] border border-white/10 bg-slate-950/94 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
      <p className="text-sm font-semibold">
        {t("expenses.moved", language)}{" "}
        {pendingMove.occurrence.template.name}{" "}
        {format(parseISO(pendingMove.dueDate), "d MMMM", { locale })}
      </p>
      <p className="mt-1 text-xs text-slate-300">
        {t("expenses.movedDetail", language)}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onApplySeries}
          className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(132,204,22,0.22)]"
        >
          {t("expenses.thisAndNext", language)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/10"
        >
          {t("common.ok", language)}
        </button>
      </div>
    </div>
  );
}
