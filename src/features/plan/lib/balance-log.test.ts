import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { activeBalanceEntries, balanceSparkline, balanceTrend } from "./balance-log";

const finance: FinanceStore = {
  ...emptyFinanceStore,
  balanceCheckins: {
    "2026-10-23": { amount: 1250.4, updatedAt: "2026-10-23T10:00:00.000Z" },
    "2026-10-01": { amount: 2100, updatedAt: "2026-10-01T10:00:00.000Z" },
    "2026-10-15": {
      amount: 900,
      updatedAt: "2026-10-16T10:00:00.000Z",
      deletedAt: "2026-10-16T10:00:00.000Z",
    },
    "2026-10-11": { amount: 1600, updatedAt: "2026-10-11T10:00:00.000Z" },
  },
};

describe("balance log", () => {
  it("lists the balances still recorded, oldest first", () => {
    expect(activeBalanceEntries(finance)).toEqual([
      { date: "2026-10-01", amount: 2100 },
      { date: "2026-10-11", amount: 1600 },
      { date: "2026-10-23", amount: 1250.4 },
    ]);
    expect(activeBalanceEntries(emptyFinanceStore)).toEqual([]);
  });

  it("compares the latest balance with the previous one", () => {
    expect(balanceTrend(activeBalanceEntries(finance))).toEqual({
      latest: { date: "2026-10-23", amount: 1250.4 },
      previous: { date: "2026-10-11", amount: 1600 },
      delta: -349.6,
    });
    expect(balanceTrend([{ date: "2026-10-01", amount: -35 }])).toEqual({
      latest: { date: "2026-10-01", amount: -35 },
      previous: null,
      delta: 0,
    });
    expect(balanceTrend([])).toBeNull();
  });

  it("places sparkline points by date and amount", () => {
    const { path, points } = balanceSparkline(activeBalanceEntries(finance), {
      width: 110,
      height: 50,
      padding: 5,
    });

    // 22 días: el 11 cae a 10/22 del ancho útil; el máximo arriba y el mínimo abajo.
    expect(points.map(({ x, y }) => [x, y])).toEqual([
      [5, 5],
      [50.5, 28.5],
      [105, 45],
    ]);
    expect(path).toBe("M5 5 L50.5 28.5 L105 45");
  });

  it("draws a flat line for equal balances and nothing for a single one", () => {
    const flat = balanceSparkline(
      [
        { date: "2026-10-01", amount: 100 },
        { date: "2026-10-02", amount: 100 },
      ],
      { width: 100, height: 40, padding: 0 },
    );
    expect(flat.points.map((point) => point.y)).toEqual([20, 20]);
    expect(balanceSparkline([{ date: "2026-10-01", amount: 1 }], { width: 100, height: 40 }))
      .toEqual({ path: "", points: [] });
  });
});
