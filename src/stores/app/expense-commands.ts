import { startOfMonth } from "date-fns";
import { buildDateWithDay, toDateOnly } from "@/domain/calendar";
import type {
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseStore,
} from "@/domain/types";
import {
  buildTemplateFromDraft,
  createId,
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import type { MonthlyExpenseOverrideInput } from "./store-types";

export function addExpenseToStore(
  store: ExpenseStore,
  draft: DraftExpense,
  options: CreateExpenseOptions = {},
): ExpenseStore {
  const categoryResult = findOrCreateCategory(store, draft.categoryName);
  const startDate = draft.startDate || toDateOnly(startOfMonth(new Date()));
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
            id: createId("ovr"),
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

export function deleteExpenseFromStore(
  store: ExpenseStore,
  templateId: string,
): ExpenseStore {
  return {
    ...store,
    templates: store.templates.filter((template) => template.id !== templateId),
    overrides: store.overrides.filter(
      (override) => override.templateId !== templateId,
    ),
  };
}

export function clearExpensesFromStore(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    categories: [],
    templates: [],
    overrides: [],
  };
}

export function togglePaidInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const existing = occurrence.override;
  const isPaid = occurrence.status === "paid";
  const overrides = isPaid
    ? store.overrides.filter((override) => override.id !== existing?.id)
    : [
        ...store.overrides.filter(
          (override) =>
            !(
              override.templateId === occurrence.template.id &&
              override.occurrenceDate === occurrence.occurrenceDate
            ),
        ),
        {
          id: existing?.id ?? createId("ovr"),
          userId: "demo",
          templateId: occurrence.template.id,
          occurrenceDate: occurrence.occurrenceDate,
          dueDate:
            occurrence.dueDate !== occurrence.occurrenceDate
              ? occurrence.dueDate
              : undefined,
          status: "paid" as const,
          paidAt: new Date().toISOString(),
          amountPaid: occurrence.template.amount,
        },
      ];

  return { ...store, overrides };
}

export function skipOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const overrides = [
    ...store.overrides.filter(
      (override) =>
        !(
          override.templateId === occurrence.template.id &&
          override.occurrenceDate === occurrence.occurrenceDate
        ),
    ),
    {
      id: occurrence.override?.id ?? createId("ovr"),
      userId: "demo",
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      dueDate:
        occurrence.dueDate !== occurrence.occurrenceDate
          ? occurrence.dueDate
          : undefined,
      sortOrder: occurrence.override?.sortOrder,
      status: "skipped" as const,
      note: "Skipped from monthly plan occurrence",
    },
  ];

  return { ...store, overrides };
}

export function moveOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
  const existing = occurrence.override;
  const unchangedDate = dueDate === occurrence.occurrenceDate;
  const nextOverride = {
    id: existing?.id ?? createId("ovr"),
    userId: "demo",
    templateId: occurrence.template.id,
    occurrenceDate: occurrence.occurrenceDate,
    dueDate: unchangedDate ? undefined : dueDate,
    sortOrder,
    status: occurrence.status,
    paidAt: existing?.paidAt,
    amountPaid: existing?.amountPaid,
    note: existing?.note,
  };

  const overrides = [
    ...store.overrides.filter(
      (override) =>
        !(
          override.templateId === occurrence.template.id &&
          override.occurrenceDate === occurrence.occurrenceDate
        ),
    ),
    nextOverride,
  ];

  return { ...store, overrides };
}

export function moveOccurrenceSeriesInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
): ExpenseStore {
  const day = new Date(`${dueDate}T00:00:00`).getDate();

  return {
    ...store,
    templates: store.templates.map((template) =>
      template.id === occurrence.template.id
        ? {
            ...template,
            dueDay: day,
            updatedAt: new Date().toISOString(),
          }
        : template,
    ),
  };
}

export function updateMonthlyExpenseOccurrenceInStore(
  store: ExpenseStore,
  input: MonthlyExpenseOverrideInput,
): ExpenseStore {
  const categoryResult = input.categoryName
    ? findOrCreateCategory(store, input.categoryName)
    : { store, categoryId: input.categoryId ?? "" };
  const nextStore = categoryResult.store;
  const existing = store.overrides.find(
    (override) =>
      override.templateId === input.templateId &&
      override.occurrenceDate === input.occurrenceDate,
  );
  const now = new Date().toISOString();
  const nextOverride = {
    id: existing?.id ?? createId("ovr"),
    userId: existing?.userId ?? "demo",
    templateId: input.templateId,
    occurrenceDate: input.occurrenceDate,
    dueDate: input.dueDate === input.occurrenceDate ? undefined : input.dueDate,
    sortOrder: existing?.sortOrder,
    status: input.status,
    name: input.name.trim(),
    amount: Math.max(Number(input.amount), 0.01),
    categoryId: categoryResult.categoryId,
    paidAt:
      input.status === "paid"
        ? existing?.paidAt ?? now
        : undefined,
    amountPaid:
      input.status === "paid"
        ? Math.max(Number(input.amount), 0.01)
        : undefined,
    note: existing?.note,
  };

  return {
    ...nextStore,
    overrides: [
      ...nextStore.overrides.filter(
        (override) =>
          !(
            override.templateId === input.templateId &&
            override.occurrenceDate === input.occurrenceDate
          ),
      ),
      nextOverride,
    ],
  };
}
