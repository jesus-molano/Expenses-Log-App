import { startOfMonth } from "date-fns";
import {
  buildDateWithDay,
  estimateChargeDate,
  normalizeDateOnly,
  toDateOnly,
} from "@/domain/calendar";
import { overrideIdFor } from "@/domain/overrides";
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
  const occurrenceDate = getInitialOccurrenceDate(draft, startDate);
  const initialOverrides =
    options.initialStatus === "paid"
      ? [
          {
            id: overrideIdFor({ templateId: template.id, occurrenceDate }),
            userId: "demo",
            templateId: template.id,
            occurrenceDate,
            status: "paid" as const,
            paidAt: new Date().toISOString(),
            amountPaid: template.amount,
          },
        ]
      : [];

  return {
    ...categoryResult.store,
    templates: [...categoryResult.store.templates, template],
    overrides: [...categoryResult.store.overrides, ...initialOverrides],
  };
}

function getInitialOccurrenceDate(draft: DraftExpense, startDate: string): string {
  const isAnchoredToStartDate =
    draft.recurrence.frequency === "once" ||
    (draft.recurrence.frequency === "custom" &&
      ["day", "week"].includes(draft.recurrence.unit ?? ""));

  if (isAnchoredToStartDate) return startDate;

  return toDateOnly(
    buildDateWithDay(new Date(`${startDate}T00:00:00`), draft.dueDay),
  );
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
      dueDate: persistableDueDate(occurrence.occurrenceDate, occurrence.dueDate),
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
    dueDate: persistableDueDate(occurrence.occurrenceDate, occurrence.dueDate),
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

  const restoredSeriesStore = {
    ...store,
    templates: store.templates.map((template) =>
      template.id === occurrence.template.id
        ? {
            ...template,
            dueDay: occurrence.template.dueDay,
            updatedAt: new Date().toISOString(),
          }
        : template,
    ),
  };

  return moveOccurrenceInStore(restoredSeriesStore, occurrence, dueDate, sortOrder);
}

export function moveOccurrenceSeriesInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
): ExpenseStore {
  const day = new Date(`${dueDate}T00:00:00`).getDate();
  return updateExpenseTemplateInStore(store, occurrence.template.id, {
    dueDay: day,
  });
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
  const amount = Math.max(Number(input.amount), 0.01);

  return upsertOccurrenceOverride(
    categoryResult.store,
    { templateId: input.templateId, occurrenceDate: input.occurrenceDate },
    {
      dueDate: persistableDueDate(input.occurrenceDate, input.dueDate),
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

function persistableDueDate(
  occurrenceDate: string,
  dueDate: string,
): string | undefined {
  if (dueDate === occurrenceDate) return undefined;

  const estimatedChargeDate = estimateChargeDate(occurrenceDate).date;
  if (
    estimatedChargeDate !== occurrenceDate &&
    dueDate === estimatedChargeDate
  ) {
    return undefined;
  }

  return dueDate;
}
