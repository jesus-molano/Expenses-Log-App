"use client";

import { format } from "date-fns";
import { ChevronRight, Home } from "lucide-react";
import type { ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import type { SmartList } from "../lib/dashboard-config";
import { smartLists } from "../lib/dashboard-config";
import { ExpenseRow } from "./ExpenseRow";

type ExpenseListProps = {
  selectedList: SmartList;
  occurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  today: string;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function ExpenseList({
  selectedList,
  occurrences,
  categories,
  today,
  onTogglePaid,
}: ExpenseListProps) {
  return (
    <section className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{smartLists[selectedList].label}</h2>
          <p className="text-sm text-slate-500">
            {format(new Date(), "dd/MM/yyyy")} - Atlantic/Canary
          </p>
        </div>
        <ChevronRight size={19} className="text-slate-300" />
      </header>

      {occurrences.length ? (
        occurrences.map((occurrence) => (
          <ExpenseRow
            key={occurrence.id}
            occurrence={occurrence}
            category={categories.find(
              (category) => category.id === occurrence.template.categoryId,
            )}
            today={today}
            onTogglePaid={onTogglePaid}
          />
        ))
      ) : (
        <div className="grid place-items-center px-6 py-14 text-center">
          <Home size={32} className="text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">Nada pendiente aqui</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Crea un gasto o cambia el filtro para ver otros cobros.
          </p>
        </div>
      )}
    </section>
  );
}
