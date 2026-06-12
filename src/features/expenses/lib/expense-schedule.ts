import type {
  CustomRecurrenceUnit,
  DraftExpense,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/domain/types";

function parseDateOnly(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthFromDate(value?: string): number {
  return (parseDateOnly(value)?.getMonth() ?? new Date().getMonth()) + 1;
}

function dayFromDate(value?: string, fallback = 1): number {
  return parseDateOnly(value)?.getDate() ?? fallback;
}

function recurrenceForFrequency(
  frequency: RecurrenceFrequency,
  current: RecurrenceRule,
  startDate?: string,
): RecurrenceRule {
  if (frequency === "once") return { frequency };
  if (frequency === "monthly") return { frequency };
  if (frequency === "quarterly") return { frequency };
  if (frequency === "yearly") {
    return {
      frequency,
      annualMonth: monthFromDate(startDate),
    };
  }
  if (frequency === "custom") {
    return {
      frequency,
      interval: Math.max(Number(current.interval) || 1, 1),
      unit: current.unit ?? "month",
    };
  }
  return current.rrule ? current : { frequency: "monthly" };
}

export function updateDraftStartDate(
  draft: DraftExpense,
  startDate: string | undefined,
): DraftExpense {
  const dueDay = dayFromDate(startDate, draft.dueDay);
  const recurrence =
    draft.recurrence.frequency === "yearly"
      ? {
          ...draft.recurrence,
          annualMonth: monthFromDate(startDate),
        }
      : draft.recurrence;

  return {
    ...draft,
    startDate,
    dueDay,
    recurrence,
  };
}

export function updateDraftRecurrence(
  draft: DraftExpense,
  frequency: RecurrenceFrequency,
): DraftExpense {
  const recurrence = recurrenceForFrequency(
    frequency,
    draft.recurrence,
    draft.startDate,
  );

  return {
    ...draft,
    recurrence,
    endDate: frequency === "once" ? undefined : draft.endDate,
  };
}

export function updateDraftCustomInterval(
  draft: DraftExpense,
  interval: number,
): DraftExpense {
  return {
    ...draft,
    recurrence: {
      frequency: "custom",
      interval: Math.max(interval || 1, 1),
      unit: draft.recurrence.unit ?? "month",
    },
  };
}

export function updateDraftCustomUnit(
  draft: DraftExpense,
  unit: CustomRecurrenceUnit,
): DraftExpense {
  return {
    ...draft,
    recurrence: {
      frequency: "custom",
      interval: Math.max(Number(draft.recurrence.interval) || 1, 1),
      unit,
    },
  };
}

export function updateDraftEndDate(
  draft: DraftExpense,
  endDate: string | undefined,
): DraftExpense {
  if (draft.recurrence.frequency === "once") {
    return { ...draft, endDate: undefined };
  }

  return {
    ...draft,
    endDate,
  };
}
