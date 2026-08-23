import {
  createIncomeEvent,
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
  toMonthId,
  updateIncomeEvent,
} from "@/domain/finance";
import {
  isPlanAccountPurpose,
  normalizePlanAccountName,
  normalizeUniquePlanAccountPurposes,
  sortPlanAccountPurposes,
} from "@/domain/plan-accounts";
import type { ExpenseStore, PlanAccount } from "@/domain/types";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlySalaryInput,
  MonthlySavingsContributionInput,
  MonthlySavingsInput,
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
      accounts: normalizePlanAccounts(input.accounts),
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

export function updateMonthlySavingsInStore(
  store: ExpenseStore,
  input: MonthlySavingsInput,
): ExpenseStore {
  return updateMonthlySavingsContributionInStore(
    updateMonthlySavingsTargetInStore(store, input),
    input,
  );
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
  const incomeBankMovements = store.bankMovements.filter(isIncomeBankMovement);

  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [],
      monthlySalary: {},
    },
    bankMovements: store.bankMovements.filter(
      (movement) => !isIncomeBankMovement(movement),
    ),
    deleted: {
      ...store.deleted,
      incomeEvents: mergeDeletedIds(
        store.deleted?.incomeEvents,
        incomeEventIds,
      ),
      bankMovements: mergeDeletedIds(
        store.deleted?.bankMovements,
        incomeBankMovements.map((movement) => movement.id),
      ),
    },
  };
}

function isIncomeBankMovement(
  movement: ExpenseStore["bankMovements"][number],
): boolean {
  return (
    movement.amount > 0 ||
    Boolean(movement.matchedIncomeEventId) ||
    Boolean(movement.matchedSalaryMonth)
  );
}

function mergeDeletedIds(
  current: string[] | undefined,
  next: string[],
): string[] {
  return Array.from(new Set([...(current ?? []), ...next]));
}

function normalizePlanAccounts(accounts: PlanAccount[]): PlanAccount[] {
  const normalized = accounts
    .slice(0, 3)
    .map((account, index) => ({
      id: account.id || `acct-${index + 1}`,
      name: normalizePlanAccountName(account.name, index),
      purposes: sortPlanAccountPurposes(
        Array.from(new Set(account.purposes.filter(isPlanAccountPurpose))),
      ),
    }));

  return normalized.length
    ? normalizeUniquePlanAccountPurposes(normalized)
    : [
        {
          id: "acct-primary",
          name: "Cuenta principal",
          purposes: ["salary", "daily"],
        },
      ];
}
