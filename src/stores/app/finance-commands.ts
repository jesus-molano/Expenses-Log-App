import {
  createIncomeEvent,
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
  salaryClearedTombstone,
  toMonthId,
  updateIncomeEvent,
} from "@/domain/finance";
import type {
  BudgetCycleAnchor,
  ExpenseStore,
  MonthClosure,
} from "@/domain/types";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlySalaryInput,
  MonthlySavingsContributionInput,
  MonthlySavingsTargetInput,
} from "./store-types";

export function updateMoneySettingsInStore(
  store: ExpenseStore,
  input: MoneySettingsInput,
): ExpenseStore {
  const monthId = toMonthId(input.savingsMonthId);
  const updatedAt = new Date().toISOString();

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...store.finance.monthlySalary,
        [monthId]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
          updatedAt,
        },
      },
      monthlySavingsTargets: {
        ...store.finance.monthlySavingsTargets,
        [monthId]: {
          amount: Math.max(Number(input.savingsTarget), 0),
          updatedAt,
        },
      },
    },
  };
}

export function updateMonthlySavingsTargetInStore(
  store: ExpenseStore,
  input: MonthlySavingsTargetInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const updatedAt = new Date().toISOString();
  const nextMonth = nextMonthId(monthId);
  const nextTargets = { ...store.finance.monthlySavingsTargets };
  if (
    monthId < toMonthId(new Date()) &&
    !(nextMonth in nextTargets)
  ) {
    nextTargets[nextMonth] = {
      amount: getMonthlySavingsTarget(store.finance, nextMonth),
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySavingsTargets: {
        ...nextTargets,
        [monthId]: {
          amount: Math.max(Number(input.savingsTarget), 0),
          updatedAt,
        },
      },
    },
  };
}

export function updateMonthlySavingsContributionInStore(
  store: ExpenseStore,
  input: MonthlySavingsContributionInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const existing = store.finance.monthlySavingsContributions?.[monthId];
  const amount = Math.max(Number(input.amount), 0);
  const updatedAt = new Date().toISOString();
  const id = existing?.id ?? createSavingsContributionId(monthId, updatedAt);
  const nextContributions = {
    ...(store.finance.monthlySavingsContributions ?? {}),
  };

  if (amount <= 0) {
    delete nextContributions[monthId];
  } else {
    nextContributions[monthId] = {
      id,
      userId: existing?.userId ?? "demo",
      monthId,
      amount,
      transferredAt:
        input.transferredAt ?? existing?.transferredAt ?? updatedAt.slice(0, 10),
      source: "manual",
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySavingsContributions: nextContributions,
    },
    deleted: {
      ...store.deleted,
      savingsContributions:
        amount <= 0
          ? Array.from(
              new Set([
                ...(store.deleted?.savingsContributions ?? []),
                id,
              ]),
            )
          : (store.deleted?.savingsContributions ?? []).filter(
              (deletedId) => deletedId !== id,
            ),
    },
  };
}

function createSavingsContributionId(monthId: string, updatedAt: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `saving:${monthId}:${randomId ?? updatedAt}`;
}

export function updateMonthlySalaryInStore(
  store: ExpenseStore,
  input: MonthlySalaryInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const updatedAt = new Date().toISOString();
  const nextMonth = nextMonthId(monthId);
  const nextSalary = { ...store.finance.monthlySalary };
  if (
    monthId < toMonthId(new Date()) &&
    !(nextMonth in nextSalary)
  ) {
    nextSalary[nextMonth] = {
      ...getMonthlySalarySettings(store.finance, nextMonth),
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...nextSalary,
        [monthId]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
          updatedAt,
        },
      },
    },
  };
}

function nextMonthId(monthId: string) {
  const [year, month] = monthId.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function addIncomeEventToStore(
  store: ExpenseStore,
  input: IncomeEventInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [createIncomeEvent(input), ...store.finance.incomeEvents],
    },
  };
}

export function updateIncomeEventInStore(
  store: ExpenseStore,
  eventId: string,
  input: IncomeEventInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: store.finance.incomeEvents.map((event) =>
        event.id === eventId ? updateIncomeEvent(event, input) : event,
      ),
    },
  };
}

export function deleteIncomeEventFromStore(
  store: ExpenseStore,
  eventId: string,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: store.finance.incomeEvents.filter(
        (event) => event.id !== eventId,
      ),
    },
    deleted: {
      ...store.deleted,
      incomeEvents: Array.from(
        new Set([...(store.deleted?.incomeEvents ?? []), eventId]),
      ),
    },
  };
}

export function clearIncomeFromStore(store: ExpenseStore): ExpenseStore {
  const incomeEventIds = store.finance.incomeEvents.map((event) => event.id);
  // Sin tombstone, fusionar con la nube devolvería los sueldos borrados.
  const clearedAt = new Date().toISOString();

  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [],
      monthlySalary: {},
    },
    deleted: {
      ...store.deleted,
      incomeEvents: mergeDeletedIds(
        store.deleted?.incomeEvents,
        incomeEventIds,
      ),
      monthlySalary: mergeDeletedIds(store.deleted?.monthlySalary, [
        salaryClearedTombstone(clearedAt),
      ]),
    },
  };
}

function mergeDeletedIds(
  current: string[] | undefined,
  next: string[],
): string[] {
  return Array.from(new Set([...(current ?? []), ...next]));
}

export function closeMonthInStore(
  store: ExpenseStore,
  monthId: string,
  now: Date = new Date(),
): ExpenseStore {
  const timestamp = afterPreviousChange(store.finance.monthClosures?.[monthId], now);
  return withMonthClosure(store, monthId, {
    closedAt: timestamp,
    updatedAt: timestamp,
  });
}

// Reabrir no borra el cierre: un borrado no sobreviviría al merge con la nube.
export function reopenMonthInStore(
  store: ExpenseStore,
  monthId: string,
  now: Date = new Date(),
): ExpenseStore {
  const closure = store.finance.monthClosures?.[monthId];
  if (!closure) return store;
  const timestamp = afterPreviousChange(closure, now);
  return withMonthClosure(store, monthId, {
    ...closure,
    reopenedAt: timestamp,
    updatedAt: timestamp,
  });
}

// Cada cierre o reapertura queda después del cambio anterior aunque el reloj
// de este dispositivo vaya atrasado: si no, reabrir no surtiría efecto y el
// merge se quedaría con la versión vieja.
function afterPreviousChange(closure: MonthClosure | undefined, now: Date) {
  const previous = closure
    ? Math.max(
        Date.parse(closure.updatedAt),
        Date.parse(closure.closedAt),
        Date.parse(closure.reopenedAt ?? closure.closedAt),
      )
    : -Infinity;
  return new Date(Math.max(now.getTime(), previous + 1)).toISOString();
}

function withMonthClosure(
  store: ExpenseStore,
  monthId: string,
  closure: MonthClosure,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      monthClosures: { ...store.finance.monthClosures, [monthId]: closure },
    },
  };
}

// Mes natural o ciclo desde el día de cobro. Se guarda con hora para que gane
// la elección más reciente al fusionar dispositivos.
export function updateBudgetCycleInStore(
  store: ExpenseStore,
  anchor: BudgetCycleAnchor,
  now: Date = new Date(),
): ExpenseStore {
  const current = store.finance.budgetCycle;
  if ((current?.anchor ?? "calendar") === anchor) return store;
  return {
    ...store,
    finance: {
      ...store.finance,
      budgetCycle: { anchor, updatedAt: timestampAfter(current?.updatedAt, now) },
    },
  };
}

// La hora de un cambio queda siempre después de la del anterior aunque el
// reloj de este dispositivo vaya atrasado: si no, el merge se quedaría con la
// versión vieja.
export function timestampAfter(previous: string | undefined, now: Date) {
  const previousTime = previous ? Date.parse(previous) : Number.NaN;
  return new Date(
    Number.isNaN(previousTime)
      ? now.getTime()
      : Math.max(now.getTime(), previousTime + 1),
  ).toISOString();
}
