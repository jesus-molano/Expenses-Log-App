"use client";

import { FormEvent, useState } from "react";
import type { DraftExpense } from "@/domain/types";
import {
  CategoryPicker,
  DayOfMonthPicker,
  ExpenseField,
  formatEuroInput,
  parseEuroInput,
  RecurrencePicker,
  TagPicker,
} from "./ExpenseFormControls";

type ExpenseFormSheetProps = {
  open: boolean;
  draft: DraftExpense;
  onClose: () => void;
  onSave: (draft: DraftExpense) => void;
};

export function ExpenseFormSheet({
  open,
  draft,
  onClose,
  onSave,
}: ExpenseFormSheetProps) {
  const [form, setForm] = useState(draft);
  const [amountText, setAmountText] = useState(() => formatEuroInput(draft.amount));

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...form,
      amount: Math.max(parseEuroInput(amountText), 0.01),
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <form
        onSubmit={submit}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-white/10 bg-slate-950 shadow-[0_0_60px_rgba(132,204,22,0.12),0_30px_80px_rgba(0,0,0,0.55)] sm:max-w-xl sm:rounded-[1.65rem]"
      >
        <div className="sticky top-0 z-10 bg-slate-950/92 px-5 pb-3 pt-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Nuevo gasto</h2>
              <p className="truncate text-sm text-slate-300">
                Revisa importe, día y repetición.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 shrink-0 rounded-full px-3 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              Cerrar
            </button>
          </header>
        </div>

        <div className="grid gap-4 px-5 pb-5">
          <ExpenseField label="Nombre">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
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
              rows={3}
              className="input-control min-h-24 py-2"
              placeholder="Notas internas, cuenta, condiciones..."
            />
          </ExpenseField>

          <div className="grid grid-cols-1 gap-3">
            <ExpenseField label="Importe">
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                required
                className="input-control"
                placeholder="15,99"
              />
            </ExpenseField>
          </div>

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
          <div className="sticky bottom-0 -mx-5 bg-slate-950/92 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
            <button
              type="submit"
              className="h-12 w-full rounded-2xl bg-lime-300 text-base font-semibold text-slate-950 shadow-[0_0_34px_rgba(132,204,22,0.28)] transition hover:bg-lime-200"
            >
              Guardar gasto
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
