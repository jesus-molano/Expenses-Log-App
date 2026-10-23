import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { buildSeriesItem, formatShortDate, getAvailableYears } from "./plan-dashboard";

describe("formatShortDate", () => {
  it("shows day and short month in the app language", () => {
    expect(formatShortDate("2026-10-15", "es")).toBe("15 oct");
    expect(formatShortDate("2026-10-15", "en")).toBe("Oct 15");
  });

  it("keeps a malformed date as written instead of throwing", () => {
    expect(formatShortDate("15/10/2026", "es")).toBe("15/10/2026");

describe("plan dashboard", () => {
  it("offers next year from December and the years of the given months", () => {
    expect(getAvailableYears(emptyStore, new Date(2026, 10, 15))).toEqual([2026]);
    expect(getAvailableYears(emptyStore, new Date(2026, 11, 1))).toEqual([2027, 2026]);
    // Diciembre cerrado el 28: enero de 2027 es el mes activo.
    expect(
      getAvailableYears(emptyStore, new Date(2026, 11, 28), ["2027-01", "2026-12"]),
    ).toEqual([2027, 2026]);
    expect(getAvailableYears(emptyStore, new Date(2026, 5, 1), ["2025-12"])).toEqual([
      2026, 2025,
    ]);
  });

  it("counts extra income up to the active month and phases months against it", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      finance: {
        ...emptyFinanceStore,
        incomeEvents: [
          {
            id: "evt-november",
            userId: "demo",
            name: "Bizum",
            amount: 40,
            currency: "EUR",
            receivedAt: "2026-11-01",
            createdAt: "2026-10-28T10:00:00.000Z",
            updatedAt: "2026-10-28T10:00:00.000Z",
          },
        ],
      },
    };
    const today = new Date(2026, 9, 28, 10);
    const november = new Date(2026, 10, 1);

    // Con octubre abierto, noviembre es proyección: su ingreso aún no cuenta.
    expect(buildSeriesItem(store, november, today, "es")).toMatchObject({
      phase: "projected",
      income: 0,
    });
    // Con noviembre activo es el mes actual y el ingreso ya cuenta.
    expect(buildSeriesItem(store, november, today, "es", "2026-11")).toMatchObject({
      phase: "current",
      income: 40,
    });
    expect(buildSeriesItem(store, new Date(2026, 9, 1), today, "es", "2026-11").phase).toBe(
      "registered",
    );
  });
});
