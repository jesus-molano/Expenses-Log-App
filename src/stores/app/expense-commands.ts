import { startOfMonth } from "date-fns";
import { buildDateWithDay, estimateChargeDate, toDateOnly } from "@/domain/calendar";
import { createIncomeEvent, toMonthId } from "@/domain/finance";
import type {
  BankMerchantAlias,
  BankMovement,
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseStore,
} from "@/domain/types";
import {
  buildTemplateFromDraft,
  createId,
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import type { BankImportInput, MonthlyExpenseOverrideInput } from "./store-types";

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

export function dismissLastChanceReminderInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const existing = occurrence.override;
  const nextOverride: ExpenseOccurrenceOverride = {
    id: existing?.id ?? createId("ovr"),
    userId: existing?.userId ?? "demo",
    templateId: occurrence.template.id,
    occurrenceDate: occurrence.occurrenceDate,
    dueDate: existing?.dueDate,
    sortOrder: existing?.sortOrder,
    status: existing?.status ?? occurrence.status,
    name: existing?.name,
    amount: existing?.amount,
    categoryId: existing?.categoryId,
    paidAt: existing?.paidAt,
    amountPaid: existing?.amountPaid,
    note: existing?.note,
    reminderDismissedAt: new Date().toISOString(),
    reminderDismissedChargeDate: occurrence.estimatedChargeDate,
  };

  return {
    ...store,
    overrides: [
      ...store.overrides.filter(
        (override) =>
          !(
            override.templateId === occurrence.template.id &&
            override.occurrenceDate === occurrence.occurrenceDate
          ),
      ),
      nextOverride,
    ],
  };
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
    bankMovements: [],
    bankMerchantAliases: [],
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
      bankMovements: mergeDeletedIds(
        store.deleted?.bankMovements,
        store.bankMovements.map((movement) => movement.id),
      ),
      bankMerchantAliases: mergeDeletedIds(
        store.deleted?.bankMerchantAliases,
        store.bankMerchantAliases.map((alias) => alias.id),
      ),
    },
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
          dueDate: persistableDueDate(
            occurrence.occurrenceDate,
            occurrence.dueDate,
          ),
          status: "paid" as const,
          paidAt: new Date().toISOString(),
          amountPaid: occurrence.template.amount,
        },
      ];

  return { ...store, overrides };
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
      dueDate: persistableDueDate(
        occurrence.occurrenceDate,
        occurrence.dueDate,
      ),
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

export function moveOccurrenceOnlyInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
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
    dueDate: persistableDueDate(input.occurrenceDate, input.dueDate),
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

export function confirmBankImportInStore(
  store: ExpenseStore,
  input: BankImportInput,
): ExpenseStore {
  return input.decisions.reduce((currentStore, decision) => {
    if (decision.action === "ignore") return currentStore;
    if (decision.action === "import") {
      return applyBankRawImport(currentStore, decision.movements);
    }
    if (decision.action === "match" && decision.templateId && decision.occurrenceDate) {
      return applyBankMatch(currentStore, {
        movements: decision.movements,
        templateId: decision.templateId,
        occurrenceDate: decision.occurrenceDate,
        movementMatches: decision.movementMatches,
        alias: decision.alias,
      });
    }
    if (decision.action === "create" && decision.expense) {
      return applyBankCreatedExpense(currentStore, decision.movements, decision.expense);
    }
    if (decision.action === "salary" && decision.salary) {
      return applyBankSalary(currentStore, {
        movements: decision.movements,
        salary: decision.salary,
        salaryMatches: decision.salaryMatches,
      });
    }
    if (decision.action === "income" && decision.incomeEvent) {
      return applyBankIncomeEvent(currentStore, decision.movements, decision.incomeEvent);
    }

    return currentStore;
  }, store);
}

function applyBankRawImport(store: ExpenseStore, movements: BankMovement[]): ExpenseStore {
  return {
    ...store,
    bankMovements: mergeRawBankMovements(store.bankMovements, movements),
  };
}

function applyBankMatch(
  store: ExpenseStore,
  input: {
    movements: BankMovement[];
    templateId: string;
    occurrenceDate: string;
    movementMatches?: Array<{
      movementId: string;
      occurrenceDate: string;
    }>;
    alias?: BankImportInput["decisions"][number]["alias"];
  },
): ExpenseStore {
  const matches = input.movements.map((movement) => ({
    movement,
    occurrenceDate:
      input.movementMatches?.find((match) => match.movementId === movement.id)
        ?.occurrenceDate ?? input.occurrenceDate,
  }));
  const matchedOverrideKeys = new Set(
    matches.map((match) => `${input.templateId}:${match.occurrenceDate}`),
  );
  const paidOverrides = matches.map(({ movement, occurrenceDate }) => {
    const existingOverride = store.overrides.find(
      (override) =>
        override.templateId === input.templateId &&
        override.occurrenceDate === occurrenceDate,
    );

    return {
      id: existingOverride?.id ?? createId("ovr"),
      userId: existingOverride?.userId ?? "demo",
      templateId: input.templateId,
      occurrenceDate,
      dueDate: existingOverride?.dueDate,
      sortOrder: existingOverride?.sortOrder,
      status: "paid",
      name: existingOverride?.name,
      amount: existingOverride?.amount,
      categoryId: existingOverride?.categoryId,
      paidAt: `${movement.bookedAt}T12:00:00.000Z`,
      amountPaid: Math.abs(movement.amount),
      note: existingOverride?.note ?? `Conciliado con ${movement.description}`,
      reminderDismissedAt: existingOverride?.reminderDismissedAt,
      reminderDismissedChargeDate: existingOverride?.reminderDismissedChargeDate,
    } satisfies ExpenseOccurrenceOverride;
  });

  return {
    ...store,
    overrides: [
      ...store.overrides.filter(
        (override) =>
          !matchedOverrideKeys.has(`${override.templateId}:${override.occurrenceDate}`),
      ),
      ...paidOverrides,
    ],
    bankMovements: mergeMatchedBankMovements(store.bankMovements, matches, {
      matchedTemplateId: input.templateId,
    }),
    bankMerchantAliases: input.alias
      ? upsertBankAlias(store.bankMerchantAliases, input.alias)
      : store.bankMerchantAliases,
  };
}

function mergeMatchedBankMovements(
  current: BankMovement[],
  incoming: Array<{
    movement: BankMovement;
    occurrenceDate: string;
  }>,
  match: Pick<BankMovement, "matchedTemplateId">,
) {
  const byFingerprint = new Map(current.map((movement) => [movement.fingerprint, movement]));
  for (const { movement, occurrenceDate } of incoming) {
    byFingerprint.set(movement.fingerprint, {
      ...movement,
      ...match,
      matchedOccurrenceDate: occurrenceDate,
    });
  }
  return Array.from(byFingerprint.values());
}

function mergeRawBankMovements(current: BankMovement[], incoming: BankMovement[]) {
  const byFingerprint = new Map(current.map((movement) => [movement.fingerprint, movement]));
  for (const movement of incoming) {
    byFingerprint.set(movement.fingerprint, movement);
  }
  return Array.from(byFingerprint.values());
}

function applyBankSalary(
  store: ExpenseStore,
  input: {
    movements: BankMovement[];
    salary: {
      amount: number;
      dayOfMonth: number;
    };
    salaryMatches?: Array<{
      movementId: string;
      monthId: string;
    }>;
  },
): ExpenseStore {
  const salaryDay = clampDay(input.salary.dayOfMonth);
  const monthlySalary = { ...store.finance.monthlySalary };
  const movementMatches = input.movements.map((movement) => ({
    movement,
    monthId:
      input.salaryMatches?.find((match) => match.movementId === movement.id)?.monthId ??
      toMonthId(movement.bookedAt),
  }));
  const incomingFingerprints = new Set(
    movementMatches.map(({ movement }) => movement.fingerprint),
  );
  const incomingAmounts = sumSalaryMovementsByMonth(movementMatches);
  const existingAmounts = sumSalaryMovementsByMonth(
    store.bankMovements
      .filter(
        (movement) =>
          movement.matchedSalaryMonth && !incomingFingerprints.has(movement.fingerprint),
      )
      .map((movement) => ({
        movement,
        monthId: movement.matchedSalaryMonth ?? toMonthId(movement.bookedAt),
      })),
  );

  for (const monthId of incomingAmounts.keys()) {
    monthlySalary[monthId] = {
      amount: Number(((existingAmounts.get(monthId) ?? 0) + (incomingAmounts.get(monthId) ?? 0)).toFixed(2)),
      dayOfMonth: salaryDay,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary,
    },
    bankMovements: mergeSalaryBankMovements(store.bankMovements, movementMatches),
  };
}

function sumSalaryMovementsByMonth(
  matches: Array<{
    movement: BankMovement;
    monthId: string;
  }>,
) {
  const sums = new Map<string, number>();

  for (const { movement, monthId } of matches) {
    sums.set(monthId, (sums.get(monthId) ?? 0) + Math.max(Number(movement.amount), 0));
  }

  return sums;
}

function applyBankIncomeEvent(
  store: ExpenseStore,
  movements: BankMovement[],
  input: NonNullable<BankImportInput["decisions"][number]["incomeEvent"]>,
): ExpenseStore {
  const incomeEvent = createIncomeEvent({
    name: input.name,
    amount: Math.max(Number(input.amount), 0.01),
    receivedAt: input.receivedAt,
    note: input.note,
  });

  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [incomeEvent, ...store.finance.incomeEvents],
    },
    bankMovements: mergeIncomeBankMovements(store.bankMovements, movements, incomeEvent.id),
  };
}

function mergeSalaryBankMovements(
  current: BankMovement[],
  incoming: Array<{
    movement: BankMovement;
    monthId: string;
  }>,
) {
  const byFingerprint = new Map(current.map((movement) => [movement.fingerprint, movement]));
  for (const { movement, monthId } of incoming) {
    byFingerprint.set(movement.fingerprint, {
      ...movement,
      matchedSalaryMonth: monthId,
    });
  }
  return Array.from(byFingerprint.values());
}

function mergeIncomeBankMovements(
  current: BankMovement[],
  incoming: BankMovement[],
  incomeEventId: string,
) {
  const byFingerprint = new Map(current.map((movement) => [movement.fingerprint, movement]));
  for (const movement of incoming) {
    byFingerprint.set(movement.fingerprint, {
      ...movement,
      matchedIncomeEventId: incomeEventId,
    });
  }
  return Array.from(byFingerprint.values());
}

function clampDay(value: number) {
  return Math.min(Math.max(Math.round(Number(value) || 1), 1), 31);
}

function applyBankCreatedExpense(
  store: ExpenseStore,
  movements: BankMovement[],
  draft: DraftExpense,
): ExpenseStore {
  const startDate = draft.startDate || movements[0]?.bookedAt || toDateOnly(new Date());
  const categoryResult = findOrCreateCategory(store, draft.categoryName);
  const template = buildTemplateFromDraft(
    normalizeDraftStartDate(draft, startDate),
    categoryResult.categoryId,
    startDate,
  );
  const overrides = movements.map((movement) => ({
    id: createId("ovr"),
    userId: "demo",
    templateId: template.id,
    occurrenceDate: movement.bookedAt,
    status: "paid" as const,
    paidAt: `${movement.bookedAt}T12:00:00.000Z`,
    amountPaid: Math.abs(movement.amount),
    note: `Creado desde importacion bancaria: ${movement.description}`,
  }));

  return {
    ...categoryResult.store,
    templates: [...categoryResult.store.templates, template],
    overrides: [...categoryResult.store.overrides, ...overrides],
    bankMovements: mergeBankMovements(categoryResult.store.bankMovements, movements, {
      matchedTemplateId: template.id,
      matchedOccurrenceDate: startDate,
    }),
    bankMerchantAliases: upsertBankAlias(categoryResult.store.bankMerchantAliases, {
      merchantKey: movements[0]?.merchantKey ?? draft.name.toLowerCase(),
      label: movements[0]?.description ?? draft.name,
      templateId: template.id,
    }),
  };
}

function mergeBankMovements(
  current: BankMovement[],
  incoming: BankMovement[],
  match: Pick<BankMovement, "matchedTemplateId" | "matchedOccurrenceDate">,
) {
  const byFingerprint = new Map(current.map((movement) => [movement.fingerprint, movement]));
  for (const movement of incoming) {
    byFingerprint.set(movement.fingerprint, {
      ...movement,
      ...match,
    });
  }
  return Array.from(byFingerprint.values());
}

function upsertBankAlias(
  aliases: BankMerchantAlias[],
  alias: {
    merchantKey: string;
    label: string;
    templateId: string;
  },
) {
  const now = new Date().toISOString();
  const existing = aliases.find(
    (item) =>
      item.templateId === alias.templateId && item.merchantKey === alias.merchantKey,
  );

  if (existing) {
    return aliases.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            label: alias.label,
            updatedAt: now,
          }
        : item,
    );
  }

  return [
    ...aliases,
    {
      id: createId("alias"),
      userId: "demo",
      merchantKey: alias.merchantKey,
      templateId: alias.templateId,
      label: alias.label,
      createdAt: now,
      updatedAt: now,
    },
  ];
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
