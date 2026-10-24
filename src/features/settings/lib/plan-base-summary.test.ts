import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { describePlanBase } from "./plan-base-summary";

const finance: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
  },
  monthlySavingsTargets: {
    "2026-01": { amount: 300, updatedAt: "2026-01-01T00:00:00.000Z" },
  },
};

describe("describePlanBase", () => {
  it("summarises the salary, payday and savings goal of the month", () => {
    expect(describePlanBase(finance, "2026-10", "es")).toMatch(
      /^Sueldo 2\.?000,00\s€ · día 28 · ahorro 300,00\s€$/,
    );
    expect(describePlanBase(finance, "2026-10", "en")).toMatch(
      /^Salary 2\.?000,00\s€ · day 28 · savings 300,00\s€$/,
    );
  });

  it("explains what it is for while there is no salary", () => {
    expect(describePlanBase(emptyFinanceStore, "2026-10", "es")).toBe(
      "Sueldo fijo, día de cobro y ahorro habitual.",
    );
  });
});
