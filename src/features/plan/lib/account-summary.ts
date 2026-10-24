import { listBalanceAccounts, type BalanceAccountView } from "@/domain/balance-accounts";
import { periodRange, type BudgetCycle } from "@/domain/budget-cycle";
import { occurrencesDueBetween } from "@/domain/finance";
import { monthPendingSummary } from "@/domain/pending";
import type { AppLanguage, ExpenseStore, FinanceStore } from "@/domain/types";
import {
  activeBalanceEntries,
  balanceTrend,
  type BalanceEntry,
  type BalanceTrend,
} from "./balance-log";

export type AccountSummary = {
  account: BalanceAccountView;
  entries: BalanceEntry[];
  trend: BalanceTrend | null;
};

// Cada cuenta que se muestra con sus saldos y el último frente al anterior.
export function summarizeAccounts(finance: FinanceStore): AccountSummary[] {
  return listBalanceAccounts(finance).map((account) => {
    const entries = activeBalanceEntries(finance, account.id);
    return { account, entries, trend: balanceTrend(entries) };
  });
}

// Lo que queda por pagar en un mes de presupuesto: la regla única de "Por
// pagar" (`monthPendingSummary`) sobre los cobros de sus días, la misma que
// la cabecera de Gastos y el plan del mes.
export function pendingInBudgetMonth(
  store: ExpenseStore,
  monthId: string,
  cycle: BudgetCycle,
  language: AppLanguage,
) {
  const range = periodRange(monthId, cycle);
  return monthPendingSummary(
    occurrencesDueBetween(store, range.start, range.end, language),
    monthId,
    range,
  ).total;
}

export type BillsCoverage = {
  // Cuentas de recibos y, de ellas, las que tienen algún saldo (las que se
  // suman).
  accountCount: number;
  countedCount: number;
  balance: number;
  pending: number;
  // Saldo menos lo que queda por pagar: negativo si no llega.
  leftover: number;
  // Fecha del saldo más antiguo de los sumados.
  balanceDate: string | null;
  // Ese saldo es de antes de que empezara el mes activo: puede no estar al día.
  stale: boolean;
};

// Saldo de las cuentas de recibos frente a lo que queda por pagar en el mes
// activo. Con varias cuentas de recibos se suma el último saldo de cada una.
// null si no hay ninguna cuenta de recibos.
export function billsCoverage(
  summaries: AccountSummary[],
  { pending, monthStart }: { pending: number; monthStart: string },
): BillsCoverage | null {
  const bills = summaries.filter((summary) => summary.account.role === "bills");
  if (!bills.length) return null;
  const latest = bills.flatMap((summary) => (summary.trend ? [summary.trend.latest] : []));
  const balance = cents(latest.reduce((sum, entry) => sum + entry.amount, 0));
  const balanceDate = latest.length
    ? latest.map((entry) => entry.date).sort()[0]
    : null;

  return {
    accountCount: bills.length,
    countedCount: latest.length,
    balance,
    pending: cents(pending),
    leftover: cents(balance - pending),
    balanceDate,
    stale: balanceDate !== null && balanceDate < monthStart,
  };
}

export type AccountInsight = {
  // Cambio desde el saldo anterior (ahorro y libre, si hay dos saldos).
  change: BalanceTrend | null;
  // Objetivo de ahorro del mes activo (solo cuentas de ahorro).
  savingsTarget: number | null;
};

// Lo que enseña cada cuenta según su papel. Las de recibos se comparan juntas
// con lo pendiente (`billsCoverage`).
export function accountInsight(
  summary: AccountSummary,
  { savingsTarget }: { savingsTarget: number },
): AccountInsight {
  const change = summary.trend?.previous ? summary.trend : null;
  switch (summary.account.role) {
    case "bills":
      return { change: null, savingsTarget: null };
    case "savings":
      return { change, savingsTarget };
    case "spending":
      return { change, savingsTarget: null };
  }
}

function cents(value: number) {
  return Math.round(value * 100) / 100;
}
