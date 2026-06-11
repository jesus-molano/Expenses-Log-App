"use client";

import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { categoryToneClass, statusLabel } from "../../lib/expense-actions";

type ExpenseRowContentProps = {
  occurrence: ExpenseOccurrence;
  category?: ExpenseCategory;
  today: string;
  language: AppLanguage;
};

export function ExpenseRowContent({
  occurrence,
  category,
  today,
  language,
}: ExpenseRowContentProps) {
  const paid = occurrence.status === "paid";

  return (
    <>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`min-w-0 truncate text-[15px] font-semibold ${
              paid
                ? "text-slate-300 line-through decoration-slate-400"
                : "text-white"
            }`}
          >
            {occurrence.template.name}
          </span>
          {category ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryToneClass(
                category.tone,
              )}`}
            >
              {categoryLabel(category.name, language)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-[14px] font-semibold ${
            paid ? "text-slate-300 line-through decoration-slate-400" : "text-white"
          }`}
        >
          {formatCurrency(occurrence.template.amount)}
        </p>
        <p
          className={`mt-0.5 whitespace-nowrap text-[11px] font-medium ${
            paid ? "app-paid-status" : "text-white"
          }`}
        >
          {statusLabel(occurrence, today, language)}
        </p>
      </div>
    </>
  );
}
