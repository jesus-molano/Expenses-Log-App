"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import { addDays, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { formatCurrency, formatShortDate, toDateOnly } from "@/domain/calendar";
import { generateOccurrences, recurrenceLabel } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";
import { loadExpenseStore, saveExpenseStore } from "@/lib/local-store";

export function ExpenseDetail({ id }: { id: string }) {
  const [store, setStore] = useState<ExpenseStore>(() => loadExpenseStore());

  const template = store?.templates.find((item) => item.id === id);
  const occurrences = useMemo(() => {
    if (!store || !template) return [];
    return generateOccurrences(
      [template],
      store.overrides,
      toDateOnly(startOfDay(new Date())),
      toDateOnly(addDays(new Date(), 365)),
    ).slice(0, 12);
  }, [store, template]);

  function archiveExpense() {
    if (!store || !template) return;
    const nextStore = {
      ...store,
      templates: store.templates.map((item) =>
        item.id === template.id
          ? { ...item, active: false, updatedAt: new Date().toISOString() }
          : item,
      ),
    };
    setStore(nextStore);
    saveExpenseStore(nextStore);
  }

  if (!template) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-center">
        <div>
          <p className="font-semibold">Gasto no encontrado</p>
          <Link className="mt-3 inline-block text-sm text-slate-600" href="/">
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-slate-700"
        >
          <ArrowLeft size={18} />
          Gastos
        </Link>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{recurrenceLabel(template.recurrence)}</p>
              <h1 className="mt-1 text-3xl font-semibold">{template.name}</h1>
              <p className="mt-2 text-slate-600">{template.description}</p>
            </div>
            <p className="text-xl font-semibold">{formatCurrency(template.amount)}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs font-medium text-slate-500">Dia de cobro</p>
              <p className="mt-1 font-semibold">Dia {template.dueDay}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs font-medium text-slate-500">Inicio</p>
              <p className="mt-1 font-semibold">{formatShortDate(template.startDate)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                #{tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={archiveExpense}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-rose-50 px-4 text-sm font-semibold text-rose-700"
          >
            <Trash2 size={17} />
            Archivar
          </button>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Proximos cobros</h2>
          </div>
          {occurrences.map((occurrence) => (
            <div
              key={occurrence.id}
              className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-0"
            >
              <div className="flex items-center gap-3">
                {occurrence.status === "paid" ? (
                  <CheckCircle2 className="text-emerald-600" size={21} />
                ) : (
                  <CalendarClock className="text-slate-400" size={21} />
                )}
                <div>
                  <p className="font-medium">{formatShortDate(occurrence.dueDate)}</p>
                  <p className="text-sm text-slate-500">{occurrence.estimatedChargeLabel}</p>
                </div>
              </div>
              <p className="font-semibold">{formatCurrency(template.amount)}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
