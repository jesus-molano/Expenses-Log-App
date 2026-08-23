import { endOfMonth, parseISO, startOfMonth, subDays } from "date-fns";
import { estimateChargeDate, toDateOnly } from "./calendar";
import { generateOccurrences } from "./recurrence";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseOccurrenceRecord,
  ExpenseStore,
  FinanceStore,
  IncomeEvent,
  MonthlyMoneyPlan,
  MonthlySavingsContribution,
  MonthlySavingsTarget,
  MonthlySalarySettings,
  PlanAccount,
} from "./types";

const DEFAULT_PAYDAY = 28;

export const defaultPlanAccounts: PlanAccount[] = [
  {
    id: "acct-primary",
    name: "Cuenta principal",
    purposes: ["salary", "daily"],
  },
  {
    id: "acct-expenses",
    name: "Cuenta gastos",
    purposes: ["expenses"],
  },
  {
    id: "acct-savings",
    name: "Cuenta ahorro",
    purposes: ["savings", "investment"],
  },
];

export const defaultFinanceStore: FinanceStore = {
  incomeEvents: [
    {
      id: "evt-bizum-demo",
      userId: "demo",
      name: "Bizum pendiente",
      amount: 40,
      currency: "EUR",
      receivedAt: "2026-06-10",
      note: "Extra puntual",
      createdAt: "2026-06-10T09:00:00.000Z",
      updatedAt: "2026-06-10T09:00:00.000Z",
    },
  ],
  monthlySalary: {
    "2026-06": {
      amount: 2200,
      dayOfMonth: 28,
    },
  },
  monthlySavingsTargets: {
    "2026-06": 300,
  },
  accounts: defaultPlanAccounts,
};

export const emptyFinanceStore: FinanceStore = {
  incomeEvents: [],
  monthlySalary: {},
  monthlySavingsTargets: {},
  accounts: defaultPlanAccounts,
};

export function toMonthId(monthDate: Date | string | null | undefined): string {
  if (typeof monthDate === "string") {
    const trimmed = monthDate.trim();
    if (/^\d{4}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateOnly(startOfMonth(parsed)).slice(0, 7);
    }

    return toDateOnly(startOfMonth(new Date())).slice(0, 7);
  }

  if (!monthDate || Number.isNaN(monthDate.getTime())) {
    return toDateOnly(startOfMonth(new Date())).slice(0, 7);
  }

  return toDateOnly(startOfMonth(monthDate)).slice(0, 7);
}

export function getMonthlySalarySettings(
  finance: FinanceStore,
  monthDate: Date | string,
): MonthlySalarySettings {
  const monthId = toMonthId(monthDate);
  const fallback: MonthlySalarySettings = {
    amount: 0,
    dayOfMonth: DEFAULT_PAYDAY,
  };

  return latestRecordValue(finance.monthlySalary, monthId, fallback);
}

export function getMonthlySavingsTarget(
  finance: FinanceStore,
  monthDate: Date | string,
): number {
  const monthId = toMonthId(monthDate);
  const value = latestRecordValue(finance.monthlySavingsTargets, monthId, 0);
  return Math.max(
    typeof value === "number" ? value : Number(value?.amount ?? 0),
    0,
  );
}

export function getMonthlySavingsTargetEntry(
  finance: FinanceStore,
  monthDate: Date | string,
): MonthlySavingsTarget | null {
  const monthId = toMonthId(monthDate);
  const value = latestRecordValue(finance.monthlySavingsTargets, monthId, 0);
  if (typeof value === "number") return null;
  return value ?? null;
}

export function getMonthlySavingsContribution(
  finance: FinanceStore,
  monthDate: Date | string,
): MonthlySavingsContribution | null {
  return finance.monthlySavingsContributions?.[toMonthId(monthDate)] ?? null;
}

function latestRecordValue<T>(
  record: Record<string, T> | undefined,
  monthId: string,
  fallback: T,
): T {
  const candidates = Object.entries(record ?? {})
    .filter(([key]) => /^\d{4}-\d{2}$/.test(key) && key <= monthId)
    .sort(([a], [b]) => b.localeCompare(a));

  return candidates[0]?.[1] ?? fallback;
}

export function buildMonthlyMoneyPlan({
  monthDate,
  finance,
  occurrences,
  today = new Date(),
  includeExtraIncome = true,
}: {
  monthDate: Date;
  finance: FinanceStore;
  occurrences: ExpenseOccurrence[];
  today?: Date;
  includeExtraIncome?: boolean;
}): MonthlyMoneyPlan {
  const monthStart = toDateOnly(startOfMonth(monthDate));
  const monthEnd = toDateOnly(endOfMonth(monthDate));
  const month = monthStart.slice(0, 7);
  const salarySettings = getMonthlySalarySettings(finance, month);
  const salaryIncomeTotal = Math.max(Number(salarySettings.amount), 0);
  const monthlySavingsTarget = getMonthlySavingsTarget(finance, month);
  const extraIncomeTotal = includeExtraIncome
    ? finance.incomeEvents
        .filter(
          (event) =>
            event.receivedAt >= monthStart && event.receivedAt <= monthEnd,
        )
        .reduce((sum, event) => sum + event.amount, 0)
    : 0;
  const incomeTotal = salaryIncomeTotal + extraIncomeTotal;
  const relevantOccurrences = occurrences
    .filter(
      (occurrence) =>
        occurrence.status !== "skipped" &&
        occurrence.dueDate >= monthStart &&
        occurrence.dueDate <= monthEnd,
  );
  const paidOccurrences = relevantOccurrences.filter(
    (occurrence) => occurrence.status === "paid",
  );
  const pendingOccurrences = relevantOccurrences.filter(
    (occurrence) => occurrence.status === "due",
  );
  const plannedExpensesTotal = relevantOccurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
  const paidExpensesTotal = paidOccurrences.reduce(
    (sum, occurrence) =>
      sum + (occurrence.override?.amountPaid ?? occurrence.record?.amountPaid ?? occurrence.template.amount),
    0,
  );
  const pendingExpensesTotal = pendingOccurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
  const expectedExpensesTotal = paidExpensesTotal + pendingExpensesTotal;
  const contribution = getMonthlySavingsContribution(finance, month);
  const savingsActual = Math.max(Number(contribution?.amount ?? 0), 0);
  const savingsReserved = Math.max(monthlySavingsTarget, savingsActual);
  const maxSavingsCapacity = Math.max(incomeTotal - expectedExpensesTotal, 0);
  const freeAccordingToPlan = Math.max(
    incomeTotal - expectedExpensesTotal - savingsReserved,
    0,
  );
  const billsShortfall = Math.max(expectedExpensesTotal - incomeTotal, 0);
  const savingsGoalShortfall = Math.max(
    monthlySavingsTarget - maxSavingsCapacity,
    0,
  );
  const currentMonthId = toMonthId(today);
  const phase =
    month < currentMonthId
      ? "registered"
      : month > currentMonthId
        ? "projected"
        : "current";
  const todayDateOnly = toDateOnly(today);
  const nextOccurrence = [...pendingOccurrences].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  )[0];
  const nextPending = nextOccurrence
    ? {
        id: nextOccurrence.id,
        name: nextOccurrence.template.name,
        dueDate: nextOccurrence.dueDate,
        amount: nextOccurrence.template.amount,
        overdue: nextOccurrence.dueDate < todayDateOnly,
      }
    : undefined;

  return {
    month,
    phase,
    plannedIncomeTotal: incomeTotal,
    incomeTotal,
    fixedIncomeTotal: salaryIncomeTotal,
    salaryIncomeTotal,
    extraIncomeTotal,
    plannedExpensesTotal,
    paidExpensesTotal,
    pendingExpensesTotal,
    expectedExpensesTotal,
    plannedExpenseCount: relevantOccurrences.length,
    paidExpenseCount: paidOccurrences.length,
    pendingExpenseCount: pendingOccurrences.length,
    savingsTarget: monthlySavingsTarget,
    savingsActual,
    savingsReserved,
    savingsGoalRemaining: Math.max(monthlySavingsTarget - savingsActual, 0),
    maxSavingsCapacity,
    freeAccordingToPlan,
    billsShortfall,
    savingsGoalShortfall,
    nextPending,
    expensesContribution: Math.min(incomeTotal, expectedExpensesTotal),
    savingsContribution: savingsActual,
    remainingContribution: freeAccordingToPlan,
    investmentContribution: 0,
    shortfall: billsShortfall,
  };
}

export function generateStoreOccurrences(
  store: ExpenseStore,
  fromDate: string,
  toDate: string,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  const dynamic = generateOccurrences(
    store.templates,
    store.overrides,
    fromDate,
    toDate,
    language,
  );
  const overridesByKey = new Map(
    store.overrides.map((override) => [
      `${override.templateId}:${override.occurrenceDate}`,
      override,
    ]),
  );
  const records = (store.occurrenceRecords ?? []).flatMap((record) => {
    const override = overridesByKey.get(
      `${record.templateId}:${record.occurrenceDate}`,
    );
    const dueDate = override?.dueDate ?? record.dueDate;
    return dueDate >= fromDate && dueDate <= toDate
      ? [occurrenceFromRecord(record, override, language)]
      : [];
  });
  const recordKeys = new Set(
    (store.occurrenceRecords ?? []).map(
      (record) => `${record.templateId}:${record.occurrenceDate}`,
    ),
  );

  return [
    ...dynamic.filter(
      (occurrence) =>
        !recordKeys.has(
          `${occurrence.template.id}:${occurrence.occurrenceDate}`,
        ),
    ),
    ...records,
  ].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder,
  );
}

export function materializeClosedOccurrenceRecords(
  store: ExpenseStore,
  options: {
    today?: Date;
    source?: ExpenseOccurrenceRecord["source"];
  } = {},
): ExpenseStore {
  const today = options.today ?? new Date();
  const closedThrough = toDateOnly(subDays(startOfMonth(today), 1));
  const firstDate = earliestOccurrenceDate(store);
  if (!firstDate || firstDate > closedThrough) {
    return { ...store, schemaVersion: 2, occurrenceRecords: store.occurrenceRecords ?? [] };
  }

  const existingById = new Map(
    (store.occurrenceRecords ?? []).map((record) => [record.id, record]),
  );
  const categoriesById = new Map(
    store.categories.map((category) => [category.id, category.name]),
  );
  const occurrences = generateStoreOccurrences(
    store,
    firstDate,
    closedThrough,
    store.preferences?.language ?? "es",
  );
  const materialized = occurrences.map((occurrence) => {
    const id = occurrenceRecordId(
      occurrence.template.id,
      occurrence.occurrenceDate,
    );
    const existing = existingById.get(id);
    const evidenceTime =
      occurrence.override?.updatedAt ??
      occurrence.override?.paidAt ??
      existing?.updatedAt ??
      occurrence.template.updatedAt;

    return {
      id,
      userId: occurrence.template.userId,
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      monthId: occurrence.dueDate.slice(0, 7),
      dueDate: occurrence.dueDate,
      name: occurrence.template.name,
      description: occurrence.template.description,
      plannedAmount: occurrence.template.amount,
      currency: occurrence.template.currency,
      categoryId: occurrence.template.categoryId,
      categoryName:
        existing?.categoryName ??
        categoriesById.get(occurrence.template.categoryId) ??
        "General",
      status: occurrence.status,
      sortOrder: occurrence.sortOrder,
      paidAt: occurrence.override?.paidAt ?? existing?.paidAt,
      amountPaid:
        occurrence.override?.amountPaid ?? existing?.amountPaid,
      source:
        existing?.source ??
        (sourceFromOccurrence(occurrence) === "bank-import"
          ? "bank-import"
          : options.source ?? "native"),
      createdAt: existing?.createdAt ?? evidenceTime,
      updatedAt: evidenceTime,
    } satisfies ExpenseOccurrenceRecord;
  });
  const materializedIds = new Set(materialized.map((record) => record.id));

  return {
    ...store,
    schemaVersion: 2,
    occurrenceRecords: [
      ...(store.occurrenceRecords ?? []).filter(
        (record) => !materializedIds.has(record.id),
      ),
      ...materialized,
    ],
  };
}

export function occurrenceRecordId(
  templateId: string,
  occurrenceDate: string,
) {
  return `record:${templateId}:${occurrenceDate}`;
}

function occurrenceFromRecord(
  record: ExpenseOccurrenceRecord,
  override: ExpenseOccurrence["override"],
  language: AppLanguage,
): ExpenseOccurrence {
  const dueDate = override?.dueDate ?? record.dueDate;
  const estimate = estimateChargeDate(dueDate, language);
  const effectiveRecord = {
    ...record,
    dueDate,
    name: override?.name ?? record.name,
    plannedAmount: override?.amount ?? record.plannedAmount,
    categoryId: override?.categoryId ?? record.categoryId,
    status: override?.status ?? record.status,
    paidAt: override?.paidAt ?? record.paidAt,
    amountPaid: override?.amountPaid ?? record.amountPaid,
    sortOrder: override?.sortOrder ?? record.sortOrder,
  };

  return {
    id: `${record.templateId}:${record.occurrenceDate}`,
    template: {
      id: record.templateId,
      userId: record.userId,
      name: effectiveRecord.name,
      description: record.description,
      amount: effectiveRecord.plannedAmount,
      currency: record.currency,
      categoryId: effectiveRecord.categoryId,
      startDate: record.occurrenceDate,
      dueDay: Number(record.occurrenceDate.slice(8, 10)),
      recurrence: { frequency: "once" },
      active: false,
      createdAt: record.createdAt,
      updatedAt: effectiveRecord.updatedAt,
    },
    occurrenceDate: record.occurrenceDate,
    dueDate,
    estimatedChargeDate: estimate.date,
    estimatedChargeLabel: estimate.label,
    status: effectiveRecord.status,
    sortOrder: effectiveRecord.sortOrder,
    override,
    record: effectiveRecord,
  };
}

function earliestOccurrenceDate(store: ExpenseStore): string | null {
  const dates = [
    ...store.templates.map((template) => template.startDate),
    ...store.overrides.map((override) => override.occurrenceDate),
    ...(store.occurrenceRecords ?? []).map((record) => record.occurrenceDate),
  ].filter(Boolean);
  return dates.sort()[0] ?? null;
}

function sourceFromOccurrence(
  occurrence: ExpenseOccurrence,
): ExpenseOccurrenceRecord["source"] {
  const note = occurrence.override?.note?.toLowerCase() ?? "";
  return note.includes("importacion bancaria") || note.includes("conciliado con")
    ? "bank-import"
    : "native";
}

export function createIncomeEvent(input: {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
}): IncomeEvent {
  const now = new Date().toISOString();
  return {
    id: `evt-${crypto.randomUUID()}`,
    userId: "demo",
    name: input.name.trim() || "Ingreso extra",
    amount: Number(input.amount),
    currency: "EUR",
    receivedAt: input.receivedAt,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateIncomeEvent(
  event: IncomeEvent,
  input: {
    name: string;
    amount: number;
    receivedAt: string;
    note?: string;
  },
): IncomeEvent {
  return {
    ...event,
    name: input.name.trim() || "Ingreso extra",
    amount: Math.max(Number(input.amount), 0),
    receivedAt: input.receivedAt,
    note: input.note?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function isEventInMonth(event: IncomeEvent, monthDate: Date): boolean {
  const date = parseISO(event.receivedAt);
  return (
    date >= startOfMonth(monthDate) &&
    date <= endOfMonth(monthDate)
  );
}
