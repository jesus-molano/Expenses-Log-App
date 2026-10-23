import { resolvePresetCategory } from "@/domain/categories";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseReminderSettings,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";

// Estado del editor del detalle: el formulario y el importe tal como se
// escribe.
export type ExpenseEditorValues = {
  form: DraftExpense;
  amountText: string;
};

export function expenseEditorValues(
  template: ExpenseTemplate,
  categoryName: string | undefined,
  language: AppLanguage,
): ExpenseEditorValues {
  return {
    amountText: formatMoneyInput(template.amount, language),
    form: {
      name: template.name,
      description: template.description,
      amount: template.amount,
      categoryName: resolvePresetCategory(categoryName ?? "General").name,
      startDate: template.startDate,
      dueDay: template.dueDay,
      endDate: template.endDate,
      recurrence: template.recurrence,
      reminder: template.reminder,
    },
  };
}

// El formulario tal como se guarda (la categoría se resuelve después contra
// el store y el importe sale de `amountText`).
export function normalizeEditorDraft(form: DraftExpense, fallbackStartDate: string) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    categoryName: form.categoryName,
    startDate: form.startDate || fallbackStartDate,
    dueDay: Math.min(Math.max(Number(form.dueDay), 1), 31),
    endDate: form.endDate || undefined,
    recurrence: form.recurrence,
    reminder: form.reminder,
  };
}

function sameRecurrence(left: RecurrenceRule, right: RecurrenceRule) {
  return (
    left.frequency === right.frequency &&
    (left.interval ?? null) === (right.interval ?? null) &&
    (left.unit ?? null) === (right.unit ?? null) &&
    (left.rrule ?? null) === (right.rrule ?? null) &&
    (left.annualMonth ?? null) === (right.annualMonth ?? null)
  );
}

// Sin aviso da igual con cuántos días se avisaría.
function sameReminder(
  left: ExpenseReminderSettings | undefined,
  right: ExpenseReminderSettings | undefined,
) {
  const leftEnabled = left?.enabled ?? false;
  const rightEnabled = right?.enabled ?? false;
  if (!leftEnabled && !rightEnabled) return true;
  return (
    leftEnabled === rightEnabled &&
    left?.daysBeforeCharge === right?.daysBeforeCharge
  );
}

// Hay cambios sin guardar si guardar cambiaría algo: espacios al final,
// "12,5" frente a "12,50" o un aviso apagado con otros días no cuentan.
export function hasUnsavedExpenseChanges(
  initial: ExpenseEditorValues,
  current: ExpenseEditorValues,
  fallbackStartDate: string,
): boolean {
  const initialAmount = parseMoneyInput(initial.amountText);
  const currentAmount = parseMoneyInput(current.amountText);
  if (initialAmount !== currentAmount) return true;
  if (currentAmount === null && initial.amountText.trim() !== current.amountText.trim()) {
    return true;
  }

  const before = normalizeEditorDraft(initial.form, fallbackStartDate);
  const after = normalizeEditorDraft(current.form, fallbackStartDate);
  return !(
    before.name === after.name &&
    before.description === after.description &&
    before.categoryName === after.categoryName &&
    before.startDate === after.startDate &&
    before.dueDay === after.dueDay &&
    before.endDate === after.endDate &&
    sameRecurrence(before.recurrence, after.recurrence) &&
    sameReminder(before.reminder, after.reminder)
  );
}
