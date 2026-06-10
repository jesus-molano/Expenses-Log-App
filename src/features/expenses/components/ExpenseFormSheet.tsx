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
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              className="input-control"
            />
          </Field>

          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows={3}
              className="input-control min-h-24 py-2"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <input
                value={form.categoryName}
                onChange={(event) =>
                  setForm({ ...form, categoryName: event.target.value })
                }
                className="input-control"
              />
            </Field>

            <Field label="Repetición">
              <select
                value={form.recurrence.frequency}
                onChange={(event) => {
                  const frequency = event.target.value as RecurrenceFrequency;
                  setForm({
                    ...form,
                    recurrence:
                      frequency === "custom"
                        ? { frequency, interval: 2, unit: "month" }
                        : frequency === "yearly"
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
          </div>

          {form.recurrence.frequency === "custom" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <option value="year">Años</option>
                </select>
              </Field>
            </div>
          ) : null}

          {form.recurrence.frequency === "yearly" ? (
            <Field label="Mes anual">
              <select
                value={form.recurrence.annualMonth ?? new Date().getMonth() + 1}
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
                {[
                  "Enero",
                  "Febrero",
                  "Marzo",
                  "Abril",
                  "Mayo",
                  "Junio",
                  "Julio",
                  "Agosto",
                  "Septiembre",
                  "Octubre",
                  "Noviembre",
                  "Diciembre",
                ].map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </Field>
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
