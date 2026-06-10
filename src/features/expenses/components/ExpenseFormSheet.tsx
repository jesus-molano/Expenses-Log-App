"use client";

import { FormEvent, useState } from "react";
import type { DraftExpense, RecurrenceFrequency } from "@/domain/types";
import { normalizeTags } from "../lib/expense-actions";

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

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[1.5rem]"
      >
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Nuevo gasto</h2>
            <p className="text-sm text-slate-500">Revisa y guarda el recordatorio.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </header>

        <div className="grid gap-4">
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              className="input-control"
            />
          </Field>

          <Field label="Descripcion">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows={3}
              className="input-control min-h-24 py-2"
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
                required
                className="input-control"
              />
            </Field>

            <Field label="Dia cobro">
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(event) =>
                  setForm({ ...form, dueDay: Number(event.target.value) })
                }
                required
                className="input-control"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <input
                value={form.categoryName}
                onChange={(event) =>
                  setForm({ ...form, categoryName: event.target.value })
                }
                className="input-control"
              />
            </Field>

            <Field label="Repeticion">
              <select
                value={form.recurrence.frequency}
                onChange={(event) => {
                  const frequency = event.target.value as RecurrenceFrequency;
                  setForm({
                    ...form,
                    recurrence:
                      frequency === "custom"
                        ? { frequency, interval: 2, unit: "month" }
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
          </div>

          {form.recurrence.frequency === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cada">
                <input
                  type="number"
                  min="1"
                  value={form.recurrence.interval ?? 1}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      recurrence: {
                        ...form.recurrence,
                        interval: Number(event.target.value),
                      },
                    })
                  }
                  className="input-control"
                />
              </Field>
              <Field label="Unidad">
                <select
                  value={form.recurrence.unit ?? "month"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      recurrence: {
                        ...form.recurrence,
                        unit: event.target.value as DraftExpense["recurrence"]["unit"],
                      },
                    })
                  }
                  className="input-control"
                >
                  <option value="day">Dias</option>
                  <option value="week">Semanas</option>
                  <option value="month">Meses</option>
                  <option value="year">Anos</option>
                </select>
              </Field>
            </div>
          ) : null}

          <Field label="Tags separados por coma">
            <input
              value={form.tags.join(", ")}
              onChange={(event) =>
                setForm({ ...form, tags: normalizeTags(event.target.value) })
              }
              className="input-control"
            />
          </Field>
        </div>

        <button
          type="submit"
          className="mt-6 h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          Guardar gasto
        </button>
      </form>
    </div>
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
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
