"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
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
    <article className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-white/70 bg-white/58 px-2.5 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <button
        type="button"
        aria-label={paid ? "Marcar como pendiente" : "Marcar como pagado"}
        onClick={() => onTogglePaid(occurrence)}
        className={`grid size-9 place-items-center rounded-full border bg-white/75 transition shadow-[0_0_20px_rgba(148,163,184,0.18)] ${
          paid
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 bg-white text-slate-400 hover:border-emerald-500 hover:text-emerald-600"
        }`}
      >
        {paid ? <Check size={19} /> : <Circle size={17} />}
      </button>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/expenses/${occurrence.template.id}`}
            className="min-w-0 truncate text-[15px] font-semibold text-slate-950"
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
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[14px] font-semibold text-slate-950">
          {formatCurrency(occurrence.template.amount)}
        </p>
        <p
          className={`mt-0.5 whitespace-nowrap text-[11px] font-medium ${
            paid ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {statusLabel(occurrence, today)}
        </p>
      </div>
    </article>
  );
}
