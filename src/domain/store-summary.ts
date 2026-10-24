import { occurrenceKeyOf } from "./overrides";
import type { ExpenseStore } from "./types";

// Lo que contiene un store contado como lo ve el usuario: gastos, pagos
// registrados (de meses abiertos o del histórico) e ingresos.
export type StoreSummary = {
  expenses: number;
  payments: number;
  incomeEvents: number;
};

export function summarizeStore(store: ExpenseStore): StoreSummary {
  const paidKeys = new Set<string>();
  const overrideKeys = new Set<string>();

  for (const override of store.overrides) {
    const key = occurrenceKeyOf(override);
    overrideKeys.add(key);
    if (override.status === "paid") paidKeys.add(key);
  }
  // Un registro cuenta salvo que un override de la misma ocurrencia lo pise.
  for (const record of store.occurrenceRecords ?? []) {
    const key = occurrenceKeyOf(record);
    if (record.status === "paid" && !overrideKeys.has(key)) paidKeys.add(key);
  }

  return {
    expenses: store.templates.length,
    payments: paidKeys.size,
    incomeEvents: store.finance.incomeEvents.length,
  };
}

// Sin nada que el usuario haya creado no merece la pena guardar una copia.
export function hasUserData(store: ExpenseStore) {
  return (
    store.templates.length > 0 ||
    store.overrides.length > 0 ||
    (store.occurrenceRecords?.length ?? 0) > 0 ||
    store.finance.incomeEvents.length > 0 ||
    Object.keys(store.finance.monthlySalary).length > 0 ||
    Object.keys(store.finance.monthlySavingsTargets).length > 0 ||
    Object.keys(store.finance.salaryExtraPays ?? {}).length > 0 ||
    Object.keys(store.finance.salaryReceipts ?? {}).length > 0 ||
    // Cuentas y saldos anotados.
    Object.keys(store.finance.balanceCheckins ?? {}).length > 0 ||
    Object.keys(store.finance.balanceAccounts ?? {}).length > 0 ||
    Object.keys(store.finance.accountCheckins ?? {}).length > 0
  );
}
