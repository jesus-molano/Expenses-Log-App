"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { formatCurrency, formatShortDate } from "@/domain/calendar";
import { recurrenceLabel } from "@/domain/recurrence";
import type { ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { categoryToneClass, statusLabel } from "../lib/expense-actions";

type ExpenseRowProps = {
  occurrence: ExpenseOccurrence;
  category?: ExpenseCategory;
  today: string;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function ExpenseRow({
  occurrence,
  category,
  today,
  onTogglePaid,
}: ExpenseRowProps) {
  const paid = occurrence.status === "paid";

  return (
    <article className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 last:border-b-0">
      <button
        type="button"
        aria-label={paid ? "Marcar como pendiente" : "Marcar como pagado"}
        onClick={() => onTogglePaid(occurrence)}
        className={`grid size-10 place-items-center rounded-full border transition ${
          paid
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 bg-white text-slate-400 hover:border-emerald-500 hover:text-emerald-600"
        }`}
      >
        {paid ? <Check size={20} /> : <Circle size={18} />}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/expenses/${occurrence.template.id}`}
            className="truncate text-[15px] font-semibold text-slate-950"
          >
            {occurrence.template.name}
          </Link>
          {category ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryToneClass(
                category.tone,
              )}`}
            >
              {category.name}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">
          {formatShortDate(occurrence.dueDate)} -{" "}
          {recurrenceLabel(occurrence.template.recurrence)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {occurrence.template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="text-right">
        <p className="text-[15px] font-semibold text-slate-950">
          {formatCurrency(occurrence.template.amount)}
        </p>
        <p
          className={`mt-1 whitespace-nowrap text-xs font-medium ${
            paid ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {statusLabel(occurrence, today)}
        </p>
      </div>
    </article>
  );
}
