"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import { resolvePresetCategory } from "@/domain/categories";
import { recurrenceLabel } from "@/domain/recurrence";
import type { ExpenseStore } from "@/domain/types";
import { loadExpenseStore, saveExpenseStore } from "@/lib/local-store";
import {
  findOrCreateCategory,
  normalizeTags,
} from "@/features/expenses/lib/expense-actions";
import {
  CategoryPicker,
  DayOfMonthPicker,
  ExpenseField,
  formatEuroInput,
  parseEuroInput,
  RecurrencePicker,
  TagPicker,
} from "@/features/expenses/components/ExpenseFormControls";

export function ExpenseDetail({ id }: { id: string }) {
  const [store, setStore] = useState<ExpenseStore>(() => loadExpenseStore());
  const template = store.templates.find((item) => item.id === id);
  const category = template
    ? store.categories.find((item) => item.id === template.categoryId)
    : null;
  const [message, setMessage] = useState("");
  const [amountText, setAmountText] = useState(() =>
    formatEuroInput(template?.amount ?? 0),
  );
  const [form, setForm] = useState(() =>
    template
      ? {
          name: template.name,
          description: template.description,
          categoryName: resolvePresetCategory(category?.name ?? "General").name,
          dueDay: template.dueDay,
          recurrence: template.recurrence,
          tags: template.tags,
        }
      : null,
  );

  function persist(nextStore: ExpenseStore) {
    setStore(nextStore);
    saveExpenseStore(nextStore);
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template || !form) return;

    const categoryResult = findOrCreateCategory(store, form.categoryName);
    const amount = Math.max(parseEuroInput(amountText), 0.01);

    persist({
      ...categoryResult.store,
      templates: categoryResult.store.templates.map((item) =>
        item.id === template.id
          ? {
              ...item,
              name: form.name.trim() || "Gasto",
              description: form.description.trim(),
              amount,
              categoryId: categoryResult.categoryId,
              dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
              recurrence: form.recurrence,
              tags: normalizeTags(form.tags.join(",")),
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

  const previewAmount = Math.max(parseEuroInput(amountText), 0);

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
                {form.name || template.name}
              </h1>
            </div>
            <p className="shrink-0 text-xl font-semibold">
              {formatCurrency(previewAmount)}
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <ExpenseField label="Nombre">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="input-control"
                placeholder="Netflix, alquiler, seguro..."
              />
            </ExpenseField>

            <ExpenseField label="Descripción">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="input-control min-h-24 py-2"
                placeholder="Notas internas, cuenta, condiciones..."
              />
            </ExpenseField>

            <ExpenseField label="Importe">
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                className="input-control"
                placeholder="15,99"
              />
            </ExpenseField>

            <CategoryPicker
              value={form.categoryName}
              onChange={(categoryName) => setForm({ ...form, categoryName })}
            />

            <DayOfMonthPicker
              value={form.dueDay}
              onChange={(dueDay) => setForm({ ...form, dueDay })}
            />

            <RecurrencePicker
              value={form.recurrence}
              onChange={(recurrence) => setForm({ ...form, recurrence })}
            />

            <TagPicker
              value={form.tags}
              onChange={(tags) => setForm({ ...form, tags })}
            />
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
      </div>
    </main>
  );
}
