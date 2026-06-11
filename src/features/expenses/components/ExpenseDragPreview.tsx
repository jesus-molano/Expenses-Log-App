"use client";

import { formatCurrency } from "@/domain/calendar";
import type { ExpenseOccurrence } from "@/domain/types";

type ExpenseDragPreviewProps = {
  occurrence: ExpenseOccurrence | null;
};

export function ExpenseDragPreview({ occurrence }: ExpenseDragPreviewProps) {
  if (!occurrence) return null;

  return (
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-lime-200/50 bg-slate-900/95 px-3 py-2.5 text-white shadow-[0_0_46px_rgba(132,204,22,0.36),0_26px_70px_rgba(0,0,0,0.58)]">
      <p className="truncate text-[15px] font-semibold">
        {occurrence.template.name}
      </p>
      <p className="text-[14px] font-semibold">
        {formatCurrency(occurrence.template.amount)}
      </p>
    </div>
  );
}
