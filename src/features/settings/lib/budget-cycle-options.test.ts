import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { describeBudgetCycle } from "./budget-cycle-options";

const withSalary: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-09": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-09-01T00:00:00.000Z" },
  },
};

describe("describeBudgetCycle", () => {
  it("defaults to the calendar month", () => {
    const cycle = describeBudgetCycle(withSalary, "2026-10-29", "es");

    expect(cycle.anchor).toBe("calendar");
    expect(cycle.shortLabel).toBe("Natural");
    expect(cycle.summary).toBe("Mes natural");
    expect(cycle.options).toEqual([
      { value: "calendar", label: "Mes natural", description: "Del día 1 al último día del mes" },
      {
        value: "payday",
        label: "Desde el día de cobro",
        description: "Del día 28 al 27 del mes siguiente",
      },
    ]);
  });

  it("shows the current cycle and its days once anchored to payday", () => {
    const cycle = describeBudgetCycle(
      { ...withSalary, budgetCycle: { anchor: "payday", updatedAt: "2026-10-20T10:00:00.000Z" } },
      "2026-10-29",
      "en",
    );

    expect(cycle.shortLabel).toBe("Payday");
    expect(cycle.summary).toBe("November: 28 Oct – 27 Nov");
  });

  it("asks for a payday when there is no salary", () => {
    const cycle = describeBudgetCycle(
      {
        ...emptyFinanceStore,
        budgetCycle: { anchor: "payday", updatedAt: "2026-10-20T10:00:00.000Z" },
      },
      "2026-10-29",
      "es",
    );

    expect(cycle.payday).toBeNull();
    expect(cycle.summary).toBe("Configura antes tu sueldo y día de cobro en «Sueldo y ahorro»");
    expect(cycle.options[1].description).toBe(cycle.summary);
  });
});
