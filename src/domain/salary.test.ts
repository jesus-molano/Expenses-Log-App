import { describe, expect, it } from "vitest";
import { configuredPayday, isSalaryPromptVisible, salaryPromptFor } from "./budget-month";
import {
  buildMonthlyMoneyPlan,
  emptyFinanceStore,
  getExpectedSalary,
  getMonthlySalarySettings,
  getSalaryExtraPay,
  getSalaryReceipt,
} from "./finance";
import type { FinanceStore } from "./types";

const salary = (amount: number, extra: Partial<FinanceStore["monthlySalary"][string]> = {}) => ({
  amount,
  dayOfMonth: 28,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

const finance: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-01": salary(2000),
    "2026-06": salary(4000, { onlyThisMonth: true }),
    "2026-09": salary(2100),
  },
};

describe("salary only for one month", () => {
  it("applies a one-month salary to its month and not to the following ones", () => {
    expect(getMonthlySalarySettings(finance, "2026-05").amount).toBe(2000);
    expect(getMonthlySalarySettings(finance, "2026-06").amount).toBe(4000);
    expect(getMonthlySalarySettings(finance, "2026-07").amount).toBe(2000);
    expect(getMonthlySalarySettings(finance, "2026-10").amount).toBe(2100);
  });

  it("has no salary after a lone one-month entry", () => {
    const lone: FinanceStore = {
      ...emptyFinanceStore,
      monthlySalary: { "2026-06": salary(1500, { onlyThisMonth: true }) },
    };

    expect(getMonthlySalarySettings(lone, "2026-07").amount).toBe(0);
    expect(configuredPayday(lone, "2026-07")).toBeNull();
    expect(configuredPayday(lone, "2026-06")).toBe(28);
  });
});

describe("extra pay", () => {
  const withExtras: FinanceStore = {
    ...emptyFinanceStore,
    monthlySalary: { "2026-01": salary(2000) },
    salaryExtraPays: {
      "2026-01": { months: [6, 12], updatedAt: "2026-01-01T00:00:00.000Z" },
      "2027-01": { months: [7], amount: 1500, updatedAt: "2027-01-01T00:00:00.000Z" },
    },
  };

  it("adds a salary more in the extra pay months", () => {
    expect(getSalaryExtraPay(withExtras, "2026-05")).toBe(0);
    expect(getSalaryExtraPay(withExtras, "2026-06")).toBe(2000);
    expect(getExpectedSalary(withExtras, "2026-12")).toBe(4000);
  });

  it("follows the settings in force in each month, with their own amount", () => {
    expect(getSalaryExtraPay(withExtras, "2027-06")).toBe(0);
    expect(getSalaryExtraPay(withExtras, "2027-07")).toBe(1500);
  });

  it("counts the extra pay in the month plan", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10T10:00:00"),
      finance: withExtras,
      occurrences: [],
      today: new Date("2026-06-10T10:00:00"),
    });

    expect(plan.salaryIncomeTotal).toBe(4000);
    expect(plan.salaryExtraPayTotal).toBe(2000);
    expect(plan.plannedIncomeTotal).toBe(4000);
    expect(plan.salaryReceipt).toBeUndefined();
  });
});

describe("salary received", () => {
  const received: FinanceStore = {
    ...emptyFinanceStore,
    monthlySalary: { "2026-01": salary(2000) },
    salaryReceipts: {
      "2026-10": { amount: 2150, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
      "2026-09": {
        amount: 1900,
        receivedOn: "2026-09-28",
        updatedAt: "2026-09-29T09:00:00.000Z",
        undone: true,
      },
    },
  };

  it("uses what was actually received as the month salary", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-10-10T10:00:00"),
      finance: received,
      occurrences: [],
      today: new Date("2026-10-28T10:00:00"),
    });

    expect(plan.salaryIncomeTotal).toBe(2150);
    expect(plan.salaryReceipt).toMatchObject({ amount: 2150, receivedOn: "2026-10-28" });
  });

  it("ignores an undone answer", () => {
    expect(getSalaryReceipt(received, "2026-09")).toBeNull();
    expect(
      buildMonthlyMoneyPlan({
        monthDate: new Date("2026-09-10T10:00:00"),
        finance: received,
        occurrences: [],
      }).salaryIncomeTotal,
    ).toBe(2000);
  });
});

describe("'¿Has cobrado?' prompt", () => {
  const configured: FinanceStore = {
    ...emptyFinanceStore,
    monthlySalary: { "2026-01": salary(2000) },
    salaryExtraPays: {
      "2026-01": { months: [12], updatedAt: "2026-01-01T00:00:00.000Z" },
    },
  };

  it("waits until payday", () => {
    expect(salaryPromptFor(configured, "2026-10-27")).toBeNull();
    expect(salaryPromptFor(configured, "2026-10-28")).toEqual({
      monthId: "2026-10",
      payday: 28,
      expectedAmount: 2000,
      extraPayAmount: 0,
    });
    expect(salaryPromptFor(configured, "2026-10-31")?.monthId).toBe("2026-10");
  });

  it("offers the extra pay in its month", () => {
    expect(salaryPromptFor(configured, "2026-12-28")).toMatchObject({
      expectedAmount: 4000,
      extraPayAmount: 2000,
    });
  });

  it("asks on the last day when payday does not exist in the month", () => {
    const end: FinanceStore = {
      ...configured,
      monthlySalary: { "2026-01": { ...salary(2000), dayOfMonth: 31 } },
    };

    expect(salaryPromptFor(end, "2027-02-27")).toBeNull();
    expect(salaryPromptFor(end, "2027-02-28")?.payday).toBe(31);
  });

  it("stops asking once answered, and asks again after undoing", () => {
    const answered: FinanceStore = {
      ...configured,
      salaryReceipts: {
        "2026-10": { amount: 2000, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
      },
    };
    const undone: FinanceStore = {
      ...configured,
      salaryReceipts: {
        "2026-10": {
          amount: 2000,
          receivedOn: "2026-10-28",
          updatedAt: "2026-10-28T09:05:00.000Z",
          undone: true,
        },
      },
    };

    expect(salaryPromptFor(answered, "2026-10-29")).toBeNull();
    expect(salaryPromptFor(undone, "2026-10-29")?.monthId).toBe("2026-10");
    // El mes siguiente vuelve a preguntar en su día de cobro.
    expect(salaryPromptFor(answered, "2026-11-28")?.monthId).toBe("2026-11");
  });

  it("asks for the payday-anchored month that payday opens", () => {
    const anchored: FinanceStore = {
      ...configured,
      budgetCycle: { anchor: "payday", updatedAt: "2026-01-01T00:00:00.000Z" },
    };
    const answered: FinanceStore = {
      ...anchored,
      salaryReceipts: {
        "2026-11": { amount: 2050, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
      },
    };

    // La nómina del 28 de octubre abre "noviembre": es el sueldo de ese mes.
    expect(salaryPromptFor(anchored, "2026-10-28")).toMatchObject({
      monthId: "2026-11",
      payday: 28,
    });
    // Lo cobrado es el sueldo del mismo mes de presupuesto que lee Plan.
    expect(salaryPromptFor(answered, "2026-11-15")).toBeNull();
    expect(
      buildMonthlyMoneyPlan({
        monthDate: new Date(2026, 10, 1),
        finance: answered,
        occurrences: [],
      }).salaryIncomeTotal,
    ).toBe(2050);
  });

  it("never asks without a configured salary", () => {
    expect(salaryPromptFor(emptyFinanceStore, "2026-10-28")).toBeNull();
  });

  it("shows in its month and in the active month, not when browsing others", () => {
    const prompt = salaryPromptFor(configured, "2026-10-28");

    expect(isSalaryPromptVisible(prompt, "2026-10", "2026-10")).toBe(true);
    // Octubre ya cerrado: el activo es noviembre y la nómina sigue sin confirmar.
    expect(isSalaryPromptVisible(prompt, "2026-11", "2026-11")).toBe(true);
    expect(isSalaryPromptVisible(prompt, "2026-10", "2026-11")).toBe(true);
    expect(isSalaryPromptVisible(prompt, "2026-09", "2026-10")).toBe(false);
    expect(isSalaryPromptVisible(prompt, "2026-11", "2026-10")).toBe(false);
    expect(isSalaryPromptVisible(null, "2026-10", "2026-10")).toBe(false);
  });
});
