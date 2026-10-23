import { endOfMonth, parseISO, startOfMonth, subDays } from "date-fns";
import { estimateChargeDate, toDateOnly } from "./calendar";
import { isOccurrenceOverdue, monthPendingSummary } from "./pending";
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
  MonthlySalarySettings,
} from "./types";

const DEFAULT_PAYDAY = 28;

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
};

export const emptyFinanceStore: FinanceStore = {
  incomeEvents: [],
  monthlySalary: {},
  monthlySavingsTargets: {},
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
  finance: Pick<FinanceStore, "monthlySalary">,
  monthDate: Date | string,
): MonthlySalarySettings {
  const monthId = toMonthId(monthDate);
  const fallback: MonthlySalarySettings = {
    amount: 0,
    dayOfMonth: DEFAULT_PAYDAY,
  };

  return latestRecordValue(finance.monthlySalary, monthId, fallback);
}

// Tombstones de sueldo: "<mes>@<hora>" o "*@<hora>" (todos los meses). Al
// fusionar desaparece cualquier sueldo de ese mes editado hasta esa hora, de
// este dispositivo o de otro; uno editado después se conserva.
export function salaryClearedTombstone(clearedAt: string, monthId = "*") {
  return `${monthId}@${clearedAt}`;
}

export function isSalaryCleared(
  tombstones: string[],
  monthId: string,
  updatedAt: string,
) {
  return tombstones.some((tombstone) => {
    const at = tombstone.indexOf("@");
    if (at < 0) return false;
    const scope = tombstone.slice(0, at);
    return (scope === "*" || scope === monthId) && updatedAt <= tombstone.slice(at + 1);
  });
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

// Fase de un mes respecto al activo (el natural, o el siguiente si el natural
// está cerrado): el activo es el "actual", lo anterior queda registrado y lo
// posterior es proyección.
export function planPhaseFor(
  monthId: string,
  activeMonthId: string,
): MonthlyMoneyPlan["phase"] {
  if (monthId === activeMonthId) return "current";
  return monthId < activeMonthId ? "registered" : "projected";
}

// `range` son los días del mes de presupuesto cuando no es el natural (ciclo
// anclado al cobro); `activeMonthId`, el mes activo según ese mismo ciclo.
export function buildMonthlyMoneyPlan({
  monthDate,
  finance,
  occurrences,
  today = new Date(),
  activeMonthId = toMonthId(today),
  includeExtraIncome = true,
  range,
}: {
  monthDate: Date;
  finance: FinanceStore;
  occurrences: ExpenseOccurrence[];
  today?: Date;
  // Mes activo; por defecto, el natural de `today`.
  activeMonthId?: string;
  includeExtraIncome?: boolean;
  range?: { start: string; end: string };
}): MonthlyMoneyPlan {
  const month = toMonthId(monthDate);
  const monthStart = range?.start ?? toDateOnly(startOfMonth(monthDate));
  const monthEnd = range?.end ?? toDateOnly(endOfMonth(monthDate));
  const phase = planPhaseFor(month, activeMonthId);
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
  const pendingSummary = monthPendingSummary(relevantOccurrences, month, {
    start: monthStart,
    end: monthEnd,
  });
  const pendingOccurrences = pendingSummary.items;
  const plannedExpensesTotal = relevantOccurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
  const paidExpensesTotal = paidOccurrences.reduce(
    (sum, occurrence) => sum + paidAmount(occurrence),
    0,
  );
  const pendingExpensesTotal = pendingSummary.total;
  const expectedExpensesTotal = paidExpensesTotal + pendingExpensesTotal;
  const contribution = getMonthlySavingsContribution(finance, month);
  const savingsActual = Math.max(Number(contribution?.amount ?? 0), 0);
  // Un mes ya registrado reserva lo que de verdad se ahorró: un objetivo que no
  // se cumplió no puede restar del libre de ese mes.
  const savingsReserved =
    phase === "registered"
      ? savingsActual
      : Math.max(monthlySavingsTarget, savingsActual);
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
        overdue: isOccurrenceOverdue(nextOccurrence, todayDateOnly),
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
  };
}

// Lo que se pagó de un cobro (puede diferir de lo previsto).
export function paidAmount(occurrence: ExpenseOccurrence) {
  return occurrence.override?.amountPaid ?? occurrence.record?.amountPaid ?? occurrence.template.amount;
}

// Lo que cuesta un cobro: lo pagado si ya se pagó y, si no, lo previsto.
export function occurrenceAmount(occurrence: ExpenseOccurrence) {
  return occurrence.status === "paid" ? paidAmount(occurrence) : occurrence.template.amount;
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
  // Un mes cerrado queda representado por sus registros: si la serie cambió
  // de día después, no se generan ocurrencias nuevas (fantasma) en ese mes.
  const recordedTemplateMonths = new Set(
    (store.occurrenceRecords ?? []).map(
      (record) => `${record.templateId}:${record.occurrenceDate.slice(0, 7)}`,
    ),
  );

  return [
    ...dynamic.filter(
      (occurrence) =>
        !recordedTemplateMonths.has(
          `${occurrence.template.id}:${occurrence.occurrenceDate.slice(0, 7)}`,
        ),
    ),
    ...records,
  ].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder,
  );
}

// Ocurrencias cuyo vencimiento efectivo cae en el rango. A diferencia de
// generateStoreOccurrences, incluye las movidas al rango desde otro mes y
// excluye las movidas fuera, para que cada cobro cuente en el mes de su dueDate.
export function occurrencesDueBetween(
  store: ExpenseStore,
  fromDate: string,
  toDate: string,
  language: AppLanguage = "es",
): ExpenseOccurrence[] {
  const isInRange = (date: string) => date >= fromDate && date <= toDate;
  const inRange = generateStoreOccurrences(
    store,
    fromDate,
    toDate,
    language,
  ).filter((occurrence) => isInRange(occurrence.dueDate));
  const seenIds = new Set(inRange.map((occurrence) => occurrence.id));
  const movedIn = store.overrides.flatMap((override) => {
    if (
      !override.dueDate ||
      !isInRange(override.dueDate) ||
      isInRange(override.occurrenceDate)
    ) {
      return [];
    }

    return generateStoreOccurrences(
      store,
      override.occurrenceDate,
      override.occurrenceDate,
      language,
    ).filter((occurrence) => {
      if (
        occurrence.template.id !== override.templateId ||
        !isInRange(occurrence.dueDate) ||
        seenIds.has(occurrence.id)
      ) {
        return false;
      }
      seenIds.add(occurrence.id);
      return true;
    });
  });

  return [...inRange, ...movedIn].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder,
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
    return { ...store, schemaVersion: 3, occurrenceRecords: store.occurrenceRecords ?? [] };
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
      source: existing?.source ?? options.source ?? "native",
      createdAt: existing?.createdAt ?? evidenceTime,
      updatedAt: evidenceTime,
    } satisfies ExpenseOccurrenceRecord;
  });
  const materializedIds = new Set(materialized.map((record) => record.id));

  return {
    ...store,
    schemaVersion: 3,
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

// Primera fecha con algo en el store: el inicio de un gasto, un override o un
// registro del histórico.
export function earliestOccurrenceDate(store: ExpenseStore): string | null {
  const dates = [
    ...store.templates.map((template) => template.startDate),
    ...store.overrides.map((override) => override.occurrenceDate),
    ...(store.occurrenceRecords ?? []).map((record) => record.occurrenceDate),
  ].filter(Boolean);
  return dates.sort()[0] ?? null;
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
