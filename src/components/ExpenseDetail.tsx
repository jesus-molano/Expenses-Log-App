"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { FormEvent, useMemo, useState } from "react";
import { formatCurrency, formatShortDate, toDateOnly } from "@/domain/calendar";
import { generateOccurrences, recurrenceLabel } from "@/domain/recurrence";
import type { ExpenseStore, RecurrenceFrequency } from "@/domain/types";
import { loadExpenseStore, saveExpenseStore } from "@/lib/local-store";
import { normalizeTags } from "@/features/expenses/lib/expense-actions";

export function ExpenseDetail({ id }: { id: string }) {
  const [store, setStore] = useState<ExpenseStore>(() => loadExpenseStore());
  const template = store.templates.find((item) => item.id === id);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() =>
    template
      ? {
          name: template.name,
          description: template.description,
          amount: template.amount,
          dueDay: template.dueDay,
          recurrence: template.recurrence,
          tags: template.tags.join(", "),
        }
      : null,
  );

  const occurrences = useMemo(() => {
    if (!template) return [];
    const today = new Date();
    return generateOccurrences(
      [template],
      store.overrides,
      toDateOnly(startOfMonth(subMonths(today, 2))),
      toDateOnly(endOfMonth(addMonths(today, 2))),
    ).filter((occurrence) => {
      const month = occurrence.dueDate.slice(0, 7);
      const currentMonth = toDateOnly(today).slice(0, 7);
      return occurrence.status === "paid" || month >= currentMonth;
    });
  }, [store.overrides, template]);

  function persist(nextStore: ExpenseStore) {
    setStore(nextStore);
    saveExpenseStore(nextStore);
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template || !form) return;

    persist({
      ...store,
      templates: store.templates.map((item) =>
        item.id === template.id
          ? {
              ...item,
              name: form.name.trim() || "Gasto",
              description: form.description.trim(),
              amount: Number(form.amount),
              dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
              recurrence: form.recurrence,
              tags: normalizeTags(form.tags),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
    setMessage("Gasto actualizado.");
  }

  function archiveExpense() {
    if (!template) return;
    persist({
      ...store,
      templates: store.templates.map((item) =>
        item.id === template.id
          ? { ...item, active: false, updatedAt: new Date().toISOString() }
          : item,
      ),
    });
    setMessage("Gasto archivado.");
  }

  if (!template || !form) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-center text-white">
        <div>
          <p className="font-semibold">Gasto no encontrado</p>
          <Link className="mt-3 inline-block text-sm text-slate-300" href="/">
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/10"
        >
          <ArrowLeft size={18} />
          Gastos
        </Link>

        <form
          onSubmit={saveExpense}
          className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-lime-100">
                {recurrenceLabel(form.recurrence)}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold">
                {template.name}
              </h1>
            </div>
            <p className="shrink-0 text-xl font-semibold">
              {formatCurrency(Number(form.amount))}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <Field label="Nombre">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="input-control"
              />
            </Field>
            <Field label="Descripción">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="input-control min-h-20 py-2"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Importe">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: Number(event.target.value) })
                  }
                  className="input-control"
                />
              </Field>
              <Field label="Dia">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(event) =>
                    setForm({ ...form, dueDay: Number(event.target.value) })
                  }
                  className="input-control"
                />
              </Field>
            </div>
            <Field label="Repetición">
              <select
                value={form.recurrence.frequency}
                onChange={(event) => {
                  const frequency = event.target.value as RecurrenceFrequency;
                  setForm({
                    ...form,
                    recurrence:
                      frequency === "yearly"
                        ? {
                            frequency,
                            annualMonth:
                              form.recurrence.annualMonth ??
                              new Date().getMonth() + 1,
                          }
                        : { frequency },
                  });
                }}
                className="input-control"
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            {form.recurrence.frequency === "yearly" ? (
              <Field label="Mes anual">
                <select
                  value={form.recurrence.annualMonth ?? 1}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      recurrence: {
                        ...form.recurrence,
                        annualMonth: Number(event.target.value),
                      },
                    })
                  }
                  className="input-control"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {format(new Date(2026, index, 1), "MMMM", { locale: es })}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Tags">
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                className="input-control"
              />
            </Field>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <button className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950">
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={archiveExpense}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-400/14 px-4 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20"
            >
              <Trash2 size={17} />
              Archivar
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        </form>

        <section className="mt-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/72 shadow-[0_18px_52px_rgba(0,0,0,0.38)]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-semibold">Cobros relevantes</h2>
            <p className="mt-1 text-sm text-slate-300">
              Historico pagado y proximos meses cercanos.
            </p>
          </div>
          {occurrences.map((occurrence) => (
            <div
              key={occurrence.id}
              className="flex items-center justify-between border-b border-white/8 px-5 py-4 last:border-0"
            >
              <div className="flex items-center gap-3">
                {occurrence.status === "paid" ? (
                  <CheckCircle2 className="text-lime-300" size={21} />
                ) : (
                  <CalendarClock className="text-cyan-200" size={21} />
                )}
                <div>
                  <p className="font-medium">{formatShortDate(occurrence.dueDate)}</p>
                  <p className="text-sm text-slate-400">
                    {occurrence.estimatedChargeLabel}
                  </p>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}
