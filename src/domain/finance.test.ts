import { describe, expect, it } from "vitest";
import {
  buildMonthlyMoneyPlan,
  defaultFinanceStore,
  emptyFinanceStore,
  generateStoreOccurrences,
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
  materializeClosedOccurrenceRecords,
} from "./finance";
import { generateOccurrences } from "./recurrence";
import type {
  ExpenseOccurrence,
  ExpenseStore,
} from "./types";

function occurrence(
  name: string,
  amount: number,
  dueDate: string,
  status: ExpenseOccurrence["status"] = "due",
): ExpenseOccurrence {
  return {
    id: name,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "cobro",
    status,
    sortOrder: 0,
    template: {
      id: name,
      userId: "demo",
      name,
      description: "",
      amount,
      currency: "EUR",
      categoryId: "cat",
      startDate: dueDate,
      dueDay: Number(dueDate.slice(-2)),
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

describe("finance", () => {
  it("allocates income to expenses, savings and main account", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: defaultFinanceStore,
      occurrences: [occurrence("Gastos de casa", 660, "2026-06-01")],
    });

    expect(plan.expensesContribution).toBe(660);
    expect(plan.savingsTarget).toBe(300);
    expect(plan.savingsContribution).toBe(0);
    expect(plan.remainingContribution).toBe(1280);
  });

  it("reports shortfall when income cannot cover fixed expenses", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: {
        ...defaultFinanceStore,
        monthlySalary: {
          "2026-06": {
            amount: 500,
            dayOfMonth: 28,
          },
        },
        incomeEvents: [],
      },
      occurrences: [occurrence("Gastos de casa", 660, "2026-06-01")],
    });

    expect(plan.expensesContribution).toBe(500);
    expect(plan.shortfall).toBe(160);
    expect(plan.remainingContribution).toBe(0);
  });

  it("does not count skipped month occurrences as fixed expenses", () => {
    const plan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-10"),
      finance: defaultFinanceStore,
      occurrences: [
        occurrence("Parking", 30, "2026-06-01", "skipped"),
        occurrence("Gastos de casa", 660, "2026-06-01"),
      ],
    });

    expect(plan.plannedExpensesTotal).toBe(660);
  });

  it("includes annual expenses only in their due month", () => {
    const templates = [
      {
        id: "exp-car-insurance",
        userId: "demo",
        name: "Seguro coche",
        description: "",
        amount: 148.5,
        currency: "EUR" as const,
        categoryId: "cat",
        startDate: "2026-05-18",
        dueDay: 18,
        recurrence: { frequency: "yearly" as const, annualMonth: 5 },
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const mayPlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-05-01"),
      finance: defaultFinanceStore,
      occurrences: generateOccurrences(templates, [], "2026-05-01", "2026-05-31"),
    });
    const junePlan = buildMonthlyMoneyPlan({
      monthDate: new Date("2026-06-01"),
      finance: defaultFinanceStore,
      occurrences: generateOccurrences(templates, [], "2026-06-01", "2026-06-30"),
    });

    expect(mayPlan.plannedExpensesTotal).toBe(148.5);
    expect(junePlan.plannedExpensesTotal).toBe(0);
  });

  it("carries salary and savings forward from the latest configured month", () => {
    const finance = {
      ...defaultFinanceStore,
      monthlySalary: {
        "2026-06": { amount: 2200, dayOfMonth: 28 },
        "2026-07": { amount: 4400, dayOfMonth: 25 },
      },
      monthlySavingsTargets: {
        "2026-06": 300,
        "2026-07": 800,
      },
    };

    expect(getMonthlySalarySettings(finance, "2026-08")).toEqual({
      amount: 4400,
      dayOfMonth: 25,
    });
    expect(getMonthlySavingsTarget(finance, "2026-08")).toBe(800);
  });

  it("keeps closed occurrences stable after a template is edited or deleted", () => {
    const template = occurrence("Internet", 60, "2026-06-08").template;
    const base: ExpenseStore = {
      schemaVersion: 2,
      categories: [
        {
          id: "cat",
          userId: "demo",
          name: "Servicios",
          icon: "WalletCards",
          tone: "blue",
        },
      ],
      templates: [{ ...template, endDate: "2026-06-30" }],
      overrides: [],
      occurrenceRecords: [],
      finance: emptyFinanceStore,
      bankMovements: [],
      bankMerchantAliases: [],
      preferences: { theme: "vice-afterglow", language: "es" },
    };
    const recorded = materializeClosedOccurrenceRecords(base, {
      today: new Date("2026-08-10T12:00:00"),
    });

    const edited: ExpenseStore = {
      ...recorded,
      categories: [{ ...recorded.categories[0], name: "Renombrada" }],
      templates: [
        {
          ...recorded.templates[0],
          name: "Internet nuevo",
          amount: 99,
          updatedAt: "2026-08-10T12:00:00.000Z",
        },
      ],
    };
    const editedJune = generateStoreOccurrences(
      edited,
      "2026-06-01",
      "2026-06-30",
    );
    const deletedJune = generateStoreOccurrences(
      { ...edited, templates: [] },
      "2026-06-01",
      "2026-06-30",
    );

    expect(editedJune[0].template).toMatchObject({
      name: "Internet",
      amount: 60,
    });
    expect(editedJune[0].record?.categoryName).toBe("Servicios");
    expect(deletedJune[0].template).toMatchObject({
      name: "Internet",
      amount: 60,
    });
  });

  it("indexes a moved historical record by its effective due date", () => {
    const template = occurrence("Seguro", 120, "2026-06-10").template;
    const recorded = materializeClosedOccurrenceRecords(
      {
        schemaVersion: 2,
        categories: [],
        templates: [{ ...template, endDate: "2026-06-30" }],
        overrides: [],
        occurrenceRecords: [],
        finance: emptyFinanceStore,
        bankMovements: [],
        bankMerchantAliases: [],
      },
      { today: new Date("2026-08-10T12:00:00") },
    );
    const moved: ExpenseStore = {
      ...recorded,
      overrides: [
        {
          id: "move-june",
          userId: "demo",
          templateId: template.id,
          occurrenceDate: "2026-06-10",
          dueDate: "2026-07-02",
          status: "due",
          updatedAt: "2026-07-01T12:00:00.000Z",
        },
      ],
    };

    expect(generateStoreOccurrences(moved, "2026-06-01", "2026-06-30"))
      .toHaveLength(0);
    expect(generateStoreOccurrences(moved, "2026-07-01", "2026-07-31"))
      .toMatchObject([{ dueDate: "2026-07-02" }]);
  });

});
