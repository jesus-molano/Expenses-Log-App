import {
  createIncomeEvent,
  toMonthId,
  updateSalarySource,
} from "@/domain/finance";
import type { ExpenseStore } from "@/domain/types";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlySavingsTargetInput,
} from "./store-types";

export function updateMoneySettingsInStore(
  store: ExpenseStore,
  input: MoneySettingsInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeSources: updateSalarySource(
        store.finance.incomeSources,
        input.salaryAmount,
        input.salaryDay,
      ),
      allocation: {
        ...store.finance.allocation,
        monthlySavingsTargets: {
          ...(store.finance.allocation.monthlySavingsTargets ?? {}),
          [toMonthId(input.savingsMonthId)]: Math.max(
            Number(input.savingsTarget),
            0,
          ),
        },
        expensesAccountName:
          input.expensesAccountName.trim() || "Cuenta gastos",
        savingsAccountName:
          input.savingsAccountName.trim() || "Cuenta ahorro",
        primaryAccountName:
          input.primaryAccountName.trim() || "Cuenta principal",
      },
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
      allocation: {
        ...store.finance.allocation,
        monthlySavingsTargets: {
          ...(store.finance.allocation.monthlySavingsTargets ?? {}),
          [toMonthId(input.monthId)]: Math.max(Number(input.savingsTarget), 0),
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
  };
}
