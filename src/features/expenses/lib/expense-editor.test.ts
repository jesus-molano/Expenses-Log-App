import { describe, expect, it } from "vitest";
import type { ExpenseTemplate } from "@/domain/types";
import {
  expenseEditorValues,
  hasUnsavedExpenseChanges,
  normalizeEditorDraft,
  type ExpenseEditorValues,
} from "./expense-editor";

const template: ExpenseTemplate = {
  id: "exp-netflix",
  userId: "demo",
  name: "Netflix",
  description: "Streaming",
  amount: 12.5,
  currency: "EUR",
  categoryId: "cat-subscriptions",
  startDate: "2026-01-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const initial = expenseEditorValues(template, "Suscripciones", "es");

function edit(change: (values: ExpenseEditorValues) => ExpenseEditorValues) {
  return hasUnsavedExpenseChanges(initial, change(structuredClone(initial)), template.startDate);
}

describe("expenseEditorValues", () => {
  it("opens the editor with the saved values and the amount as typed in the language", () => {
    expect(initial.amountText).toBe("12,5");
    expect(expenseEditorValues(template, undefined, "en").amountText).toBe("12.5");
    expect(initial.form).toMatchObject({
      name: "Netflix",
      categoryName: "Suscripciones",
      startDate: "2026-01-05",
      dueDay: 5,
    });
    expect(expenseEditorValues(template, undefined, "es").form.categoryName).toBe("General");
    // Una categoría propia se abre con su nombre, no como General.
    expect(expenseEditorValues(template, "Caprichos", "es").form.categoryName).toBe("Caprichos");
  });

  it("opens the contract details of the series", () => {
    const withDetails = expenseEditorValues(
      { ...template, notes: "Permanencia", paymentMethod: "direct_debit", commitmentEndDate: "2027-03-15" },
      "Suscripciones",
      "es",
    );
    expect(withDetails.form).toMatchObject({
      notes: "Permanencia",
      paymentMethod: "direct_debit",
      commitmentEndDate: "2027-03-15",
    });
  });

  it("edits the amount that applies now when the series has price changes", () => {
    const priced = expenseEditorValues(template, "Suscripciones", "es", 13.99);

    expect(priced.amountText).toBe("13,99");
    expect(priced.form.amount).toBe(13.99);
  });
});

describe("normalizeEditorDraft", () => {
  it("trims texts, clamps the day and falls back to the saved start date", () => {
    expect(
      normalizeEditorDraft(
        { ...initial.form, name: "  Netflix ", description: " x ", dueDay: 40, startDate: "", endDate: "" },
        "2026-01-05",
      ),
    ).toMatchObject({
      name: "Netflix",
      description: "x",
      dueDay: 31,
      startDate: "2026-01-05",
      endDate: undefined,
    });
  });
});

describe("hasUnsavedExpenseChanges", () => {
  it("is clean right after opening", () => {
    expect(hasUnsavedExpenseChanges(initial, initial, template.startDate)).toBe(false);
  });

  it("detects a change in any saved field", () => {
    expect(edit((values) => ({ ...values, form: { ...values.form, name: "Netflix 4K" } }))).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, description: "" } }))).toBe(true);
    expect(edit((values) => ({ ...values, amountText: "13" }))).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, categoryName: "Ocio" } }))).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, startDate: "2026-02-05" } }))).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, dueDay: 6 } }))).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, endDate: "2026-12-31" } }))).toBe(true);
    expect(
      edit((values) => ({
        ...values,
        form: { ...values.form, recurrence: { frequency: "yearly", annualMonth: 1 } },
      })),
    ).toBe(true);
    expect(
      edit((values) => ({
        ...values,
        form: { ...values.form, reminder: { enabled: true, daysBeforeCharge: 3 } },
      })),
    ).toBe(true);
  });

  it("detects contract details and ignores ones that would save the same", () => {
    expect(edit((values) => ({ ...values, form: { ...values.form, notes: "Permanencia" } }))).toBe(true);
    expect(
      edit((values) => ({ ...values, form: { ...values.form, paymentMethod: "card" } })),
    ).toBe(true);
    expect(edit((values) => ({ ...values, form: { ...values.form, notes: "   " } }))).toBe(false);
    expect(
      edit((values) => ({ ...values, form: { ...values.form, cancellationUrl: "javascript:x" } })),
    ).toBe(false);
  });

  it("treats an emptied or invalid amount as a change", () => {
    expect(edit((values) => ({ ...values, amountText: "" }))).toBe(true);
    expect(edit((values) => ({ ...values, amountText: "12,5x" }))).toBe(true);
  });

  it("ignores edits that would save the same expense", () => {
    expect(edit((values) => ({ ...values, amountText: "12,50" }))).toBe(false);
    expect(edit((values) => ({ ...values, form: { ...values.form, name: "Netflix  " } }))).toBe(false);
    expect(edit((values) => ({ ...values, form: { ...values.form, startDate: "" } }))).toBe(false);
    expect(edit((values) => ({ ...values, form: { ...values.form, endDate: "" } }))).toBe(false);
    // Volver a la misma frecuencia crea otro objeto con los mismos valores.
    expect(
      edit((values) => ({ ...values, form: { ...values.form, recurrence: { frequency: "monthly" } } })),
    ).toBe(false);
    // Un aviso propio apagado con otros días no cambia nada.
    const ownOff = expenseEditorValues(
      { ...template, reminder: { enabled: false, daysBeforeCharge: 3 } },
      "Suscripciones",
      "es",
    );
    expect(
      hasUnsavedExpenseChanges(
        ownOff,
        { ...ownOff, form: { ...ownOff.form, reminder: { enabled: false, daysBeforeCharge: 5 } } },
        template.startDate,
      ),
    ).toBe(false);
  });

  it("treats leaving or going back to the default reminder as a change", () => {
    // Sin aviso propio el gasto sigue el de Ajustes (que puede avisar):
    // apagarlo aquí deja de seguirlo.
    expect(
      edit((values) => ({
        ...values,
        form: { ...values.form, reminder: { enabled: false, daysBeforeCharge: 3 } },
      })),
    ).toBe(true);
    // "Usar el ajuste general" quita el aviso propio.
    const ownOff = expenseEditorValues(
      { ...template, reminder: { enabled: false, daysBeforeCharge: 3 } },
      "Suscripciones",
      "es",
    );
    expect(
      hasUnsavedExpenseChanges(
        ownOff,
        { ...ownOff, form: { ...ownOff.form, reminder: undefined } },
        template.startDate,
      ),
    ).toBe(true);
  });

  it("is clean again after undoing an edit", () => {
    const edited: ExpenseEditorValues = {
      ...initial,
      form: { ...initial.form, name: "Disney+" },
    };
    expect(hasUnsavedExpenseChanges(initial, edited, template.startDate)).toBe(true);
    const undone: ExpenseEditorValues = {
      ...edited,
      form: { ...edited.form, name: "Netflix" },
    };
    expect(hasUnsavedExpenseChanges(initial, undone, template.startDate)).toBe(false);
  });
});
