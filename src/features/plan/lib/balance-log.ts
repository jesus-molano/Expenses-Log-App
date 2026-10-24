import { PRIMARY_ACCOUNT_ID, balanceCheckinsOf } from "@/domain/balance-accounts";
import { daysBetween } from "@/domain/calendar";
import type { FinanceStore } from "@/domain/types";

export type BalanceEntry = { date: string; amount: number };

// Saldos anotados de una cuenta que siguen vigentes, del más antiguo al más
// reciente.
export function activeBalanceEntries(
  finance: FinanceStore,
  accountId: string = PRIMARY_ACCOUNT_ID,
): BalanceEntry[] {
  return Object.entries(balanceCheckinsOf(finance, accountId))
    .filter(([, checkin]) => !checkin.deletedAt)
    .map(([date, checkin]) => ({ date, amount: checkin.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type BalanceTrend = {
  latest: BalanceEntry;
  previous: BalanceEntry | null;
  // Cambio desde el saldo anterior (0 si solo hay uno).
  delta: number;
};

export function balanceTrend(entries: BalanceEntry[]): BalanceTrend | null {
  const latest = entries.at(-1);
  if (!latest) return null;
  const previous = entries.at(-2) ?? null;
  return {
    latest,
    previous,
    delta: previous ? Math.round((latest.amount - previous.amount) * 100) / 100 : 0,
  };
}

export type SparklinePoint = BalanceEntry & { x: number; y: number };

// Línea de evolución: x proporcional a los días entre saldos e y entre el
// mínimo y el máximo (una línea plana si todos son iguales). Coordenadas en
// el espacio `width` × `height`, con `padding` libre alrededor.
export function balanceSparkline(
  entries: BalanceEntry[],
  { width, height, padding = 4 }: { width: number; height: number; padding?: number },
): { path: string; points: SparklinePoint[] } {
  if (entries.length < 2) return { path: "", points: [] };

  const first = entries[0];
  const span = Math.max(daysBetween(first.date, entries.at(-1)!.date), 1);
  const amounts = entries.map((entry) => entry.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const points = entries.map((entry) => ({
    ...entry,
    x: round(padding + (daysBetween(first.date, entry.date) / span) * innerWidth),
    y: round(
      max === min
        ? padding + innerHeight / 2
        : padding + ((max - entry.amount) / (max - min)) * innerHeight,
    ),
  }));

  return {
    path: points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "),
    points,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
