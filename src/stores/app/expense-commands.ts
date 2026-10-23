import { startOfMonth } from "date-fns";
import { normalizeDateOnly, toDateOnly } from "@/domain/calendar";
import { occurrenceKeyOf, overrideIdFor } from "@/domain/overrides";
import { firstChargeAlreadyPassed, firstOccurrenceDate } from "@/domain/recurrence";
import type {
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import {
  buildTemplateFromDraft,
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import {
  rekeyOverridesForTemplateChange,
  upsertOccurrenceOverride,
} from "./occurrence-overrides";
import type { MonthlyExpenseOverrideInput } from "./store-types";

export function addExpenseToStore(
  store: ExpenseStore,
  draft: DraftExpense,
  options: CreateExpenseOptions = {},
): ExpenseStore {
  const categoryResult = findOrCreateCategory(store, draft.categoryName);
  const startDate =
    normalizeDateOnly(draft.startDate) ?? toDateOnly(startOfMonth(new Date()));
  const template = buildTemplateFromDraft(
    normalizeDraftStartDate(draft, startDate),
    categoryResult.categoryId,
    startDate,
  );
  // El pago inicial va al primer cobro real (en un anual, su mes).
  const occurrenceDate = firstOccurrenceDate(template) ?? startDate;
  const now = new Date().toISOString();
  const initialOverrides =
    options.initialStatus === "paid"
      ? [
          {
            id: overrideIdFor({ templateId: template.id, occurrenceDate }),
            userId: "demo",
            templateId: template.id,
            occurrenceDate,
            status: "paid" as const,
            paidAt: now,
            amountPaid: template.amount,
            updatedAt: now,
            statusUpdatedAt: now,
          },
        ]
      : [];

  return {
    ...categoryResult.store,
    templates: [...categoryResult.store.templates, template],
    overrides: [...categoryResult.store.overrides, ...initialOverrides],
  };
}

function normalizeDraftStartDate(draft: DraftExpense, startDate: string): DraftExpense {
  if (draft.recurrence.frequency !== "yearly") return draft;
  if (draft.recurrence.annualMonth) return draft;

  return {
    ...draft,
    recurrence: {
      ...draft.recurrence,
      annualMonth: new Date(`${startDate}T00:00:00`).getMonth() + 1,
    },
  };
}

// Varios borradores de una captura, en un solo cambio del store. Solo los
// que tienen importe: uno sin él no es un gasto que se pueda guardar. "Ya
// pagado" solo se aplica a los que ya se cobraron este mes.
export function addExpensesToStore(
  store: ExpenseStore,
  drafts: DraftExpense[],
  options: CreateExpenseOptions = {},
): ExpenseStore {
  const today = toDateOnly(new Date());
  return drafts
    .filter((draft) => Number.isFinite(draft.amount) && draft.amount > 0)
    .reduce(
      (current, draft) =>
        addExpenseToStore(current, draft, {
          initialStatus:
            options.initialStatus === "paid" && firstChargeAlreadyPassed(draft, today)
              ? "paid"
              : "due",
        }),
      store,
    );
}

export function dismissLastChanceReminderInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const now = new Date().toISOString();
  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      reminderDismissedAt: now,
      reminderDismissedChargeDate: occurrence.estimatedChargeDate,
    },
    { defaults: { status: occurrence.status }, now },
  );
}

export function deleteExpenseFromStore(
  store: ExpenseStore,
  templateId: string,
): ExpenseStore {
  const templateOverrideIds = store.overrides
    .filter((override) => override.templateId === templateId)
    .map((override) => override.id);

  return {
    ...store,
    templates: store.templates.filter((template) => template.id !== templateId),
    overrides: store.overrides.filter(
      (override) => override.templateId !== templateId,
    ),
    deleted: {
      ...store.deleted,
      templates: mergeDeletedIds(store.deleted?.templates, [templateId]),
      overrides: mergeDeletedIds(store.deleted?.overrides, templateOverrideIds),
    },
  };
}

export function clearExpensesFromStore(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    categories: [],
    templates: [],
    overrides: [],
    deleted: {
      ...store.deleted,
      categories: mergeDeletedIds(
        store.deleted?.categories,
        store.categories.map((category) => category.id),
      ),
      templates: mergeDeletedIds(
        store.deleted?.templates,
        store.templates.map((template) => template.id),
      ),
      overrides: mergeDeletedIds(
        store.deleted?.overrides,
        store.overrides.map((override) => override.id),
      ),
    },
  };
}

// Marca un cobro como pagado (siempre pagado, no alterna), con lo pagado de
// verdad si se indica. Si ya estaba pagado conserva la fecha del pago y solo
// corrige el importe.
export function payOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  amountPaid: number = occurrence.template.amount,
): ExpenseStore {
  const now = new Date().toISOString();
  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      status: "paid",
      paidAt: occurrence.status === "paid" ? occurrence.override?.paidAt ?? now : now,
      amountPaid,
    },
    { now },
  );
}

export function togglePaidInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const now = new Date().toISOString();
  if (occurrence.status === "paid") {
    return upsertOccurrenceOverride(
      store,
      keyOf(occurrence),
      { status: "due", paidAt: undefined, amountPaid: undefined },
      { now },
    );
  }

  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      status: "paid",
      paidAt: now,
      amountPaid: occurrence.template.amount,
    },
    { now },
  );
}

function mergeDeletedIds(
  current: string[] | undefined,
  next: string[],
): string[] {
  return Array.from(new Set([...(current ?? []), ...next]));
}

export function skipOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  return upsertOccurrenceOverride(store, keyOf(occurrence), {
    status: "skipped",
  });
}

export function restoreOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  return upsertOccurrenceOverride(store, keyOf(occurrence), { status: "due" });
}

export function moveOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      dueDate: dueDate === occurrence.occurrenceDate ? undefined : dueDate,
      sortOrder,
    },
    { defaults: { status: occurrence.status } },
  );
}

export function moveOccurrenceOnlyInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
  // Una ocurrencia de un mes cerrado lleva una plantilla sintética: su dueDay
  // no es el de la serie y no debe escribirse en ella.
  if (occurrence.record) {
    return moveOccurrenceInStore(store, occurrence, dueDate, sortOrder);
  }

  // Tras arrastrar se aplica el cambio de serie y se pregunta: "solo este mes"
  // lo deshace con el mismo rekey, para devolver pagos y ediciones a su fecha.
  const restoredSeriesStore = updateExpenseTemplateInStore(
    store,
    occurrence.template.id,
    { dueDay: occurrence.template.dueDay },
  );

  return moveOccurrenceInStore(restoredSeriesStore, occurrence, dueDate, sortOrder);
}

export function moveOccurrenceSeriesInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
): ExpenseStore {
  const day = new Date(`${dueDate}T00:00:00`).getDate();
  const key = { templateId: occurrence.template.id, occurrenceDate: dueDate };
  const moved = updateExpenseTemplateInStore(store, key.templateId, {
    dueDay: day,
  });

  // Si este cobro ya estaba movido, el rekey le conserva la fecha anterior:
  // tiene que caer donde se soltó.
  const landed = moved.overrides.find(
    (override) => occurrenceKeyOf(override) === occurrenceKeyOf(key),
  );
  return landed?.dueDate
    ? upsertOccurrenceOverride(moved, key, { dueDate: undefined })
    : moved;
}

// Cambia la serie y recoloca los overrides de los meses abiertos si cambia su
// calendario, para que el pago o el movimiento de este mes no se pierda.
export function updateExpenseTemplateInStore(
  store: ExpenseStore,
  templateId: string,
  changes: Partial<Omit<ExpenseTemplate, "id" | "userId" | "createdAt">>,
  today: Date = new Date(),
): ExpenseStore {
  const previous = store.templates.find((template) => template.id === templateId);
  if (!previous) return store;

  const next: ExpenseTemplate = {
    ...previous,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  return rekeyOverridesForTemplateChange(
    {
      ...store,
      templates: store.templates.map((template) =>
        template.id === templateId ? next : template,
      ),
    },
    previous,
    next,
    today,
  );
}

export function updateMonthlyExpenseOccurrenceInStore(
  store: ExpenseStore,
  input: MonthlyExpenseOverrideInput,
): ExpenseStore {
  const categoryResult = input.categoryName
    ? findOrCreateCategory(store, input.categoryName)
    : { store, categoryId: input.categoryId ?? "" };
  const existing = store.overrides.find(
    (override) =>
      override.templateId === input.templateId &&
      override.occurrenceDate === input.occurrenceDate,
  );
  const now = new Date().toISOString();
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return store;

  return upsertOccurrenceOverride(
    categoryResult.store,
    { templateId: input.templateId, occurrenceDate: input.occurrenceDate },
    {
      dueDate: input.dueDate === input.occurrenceDate ? undefined : input.dueDate,
      status: input.status,
      name: input.name.trim(),
      amount,
      categoryId: categoryResult.categoryId,
      paidAt: input.status === "paid" ? existing?.paidAt ?? now : undefined,
      amountPaid: input.status === "paid" ? amount : undefined,
    },
    { now },
  );
}

function keyOf(occurrence: ExpenseOccurrence) {
  return {
    templateId: occurrence.template.id,
    occurrenceDate: occurrence.occurrenceDate,
  };
}
