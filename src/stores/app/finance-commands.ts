import {
  createIncomeEvent,
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
  MonthlySavingsTargetInput,
} from "./store-types";

export function updateMoneySettingsInStore(
  store: ExpenseStore,
  input: MoneySettingsInput,
): ExpenseStore {
  const monthId = toMonthId(input.savingsMonthId);

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...store.finance.monthlySalary,
        [monthId]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
        },
      },
      monthlySavingsTargets: {
        ...store.finance.monthlySavingsTargets,
        [monthId]: Math.max(Number(input.savingsTarget), 0),
      },
      accounts: normalizePlanAccounts(input.accounts),
    },
  };
}

export function updateMonthlySavingsTargetInStore(
  store: ExpenseStore,
  input: MonthlySavingsTargetInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySavingsTargets: {
        ...store.finance.monthlySavingsTargets,
        [toMonthId(input.monthId)]: Math.max(Number(input.savingsTarget), 0),
      },
    },
  };
}

export function updateMonthlySalaryInStore(
  store: ExpenseStore,
  input: MonthlySalaryInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...store.finance.monthlySalary,
        [toMonthId(input.monthId)]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
        },
      },
    },
  };
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
