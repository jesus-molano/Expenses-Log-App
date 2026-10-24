import { describe, expect, it } from "vitest";
import { CALENDAR_CYCLE, type BudgetCycle } from "@/domain/budget-cycle";
import { emptyFinanceStore } from "@/domain/finance";
import { monthPendingSummary } from "@/domain/pending";
import { emptyStore } from "@/domain/seed";
import type {
  BalanceAccount,
  ExpenseStore,
  ExpenseTemplate,
  FinanceStore,
} from "@/domain/types";
import {
  accountInsight,
  billsCoverage,
  pendingInBudgetMonth,
  summarizeAccounts,
  type AccountSummary,
} from "./account-summary";
import { occurrencesForMonth } from "./plan-dashboard";

const at = "2026-10-01T10:00:00.000Z";

function account(role: BalanceAccount["role"], order: number, name = ""): BalanceAccount {
  return { name, role, order, createdAt: at, updatedAt: at };
}

function template(id: string, amount: number, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: at,
    updatedAt: at,
  };
}

const finance: FinanceStore = {
  ...emptyFinanceStore,
  balanceCheckins: {
    "2026-09-28": { amount: 1500, updatedAt: at },
    "2026-10-20": { amount: 1200, updatedAt: at },
  },
  balanceAccounts: {
    savings: account("savings", 1, "BBVA ahorro"),
    spending: account("spending", 2, "BBVA"),
    extraBills: account("bills", 3, "Nómina"),
  },
  accountCheckins: {
    "savings:2026-10-01": { amount: 5000, updatedAt: at },
    "savings:2026-10-15": { amount: 5300, updatedAt: at },
    "spending:2026-10-10": { amount: 400, updatedAt: at },
  },
};

describe("summarizeAccounts", () => {
  it("lists each account with its own history and latest change", () => {
    const summaries = summarizeAccounts(finance);

    expect(summaries.map((summary) => summary.account.id)).toEqual([
      "primary",
      "savings",
      "spending",
      "extraBills",
    ]);
    expect(summaries[0].entries).toEqual([
      { date: "2026-09-28", amount: 1500 },
      { date: "2026-10-20", amount: 1200 },
    ]);
    expect(summaries[1].trend).toMatchObject({ latest: { amount: 5300 }, delta: 300 });
    expect(summaries[2].trend).toMatchObject({ latest: { amount: 400 }, previous: null });
    expect(summaries[3].trend).toBeNull();
  });
});

describe("billsCoverage", () => {
  const monthStart = "2026-10-01";

  it("compares the bills balance with what is still pending", () => {
    const [primary] = summarizeAccounts(finance);

    expect(billsCoverage([primary], { pending: 800, monthStart })).toEqual({
      accountCount: 1,
      countedCount: 1,
      balance: 1200,
      pending: 800,
      leftover: 400,
      balanceDate: "2026-10-20",
      stale: false,
    });
    expect(billsCoverage([primary], { pending: 1350.5, monthStart })?.leftover).toBe(-150.5);
  });

  it("adds up several bills accounts and flags the oldest balance when it predates the month", () => {
    const summaries = summarizeAccounts({
      ...finance,
      accountCheckins: {
        ...finance.accountCheckins,
        "extraBills:2026-09-30": { amount: 300.1, updatedAt: at },
      },
    });

    expect(billsCoverage(summaries, { pending: 1000, monthStart })).toMatchObject({
      accountCount: 2,
      countedCount: 2,
      balance: 1500.1,
      leftover: 500.1,
      balanceDate: "2026-09-30",
      stale: true,
    });
  });

  it("still reports what is pending when no bills account has a balance", () => {
    const summaries = summarizeAccounts({ ...finance, balanceCheckins: {} });

    expect(billsCoverage(summaries, { pending: 75, monthStart })).toMatchObject({
      accountCount: 1,
      countedCount: 0,
      balance: 0,
      pending: 75,
      balanceDate: null,
      stale: false,
    });
  });

  it("is null without a bills account", () => {
    const summaries = summarizeAccounts(finance).filter(
      (summary) => summary.account.role !== "bills",
    );
    expect(billsCoverage(summaries, { pending: 75, monthStart })).toBeNull();
  });
});

describe("accountInsight", () => {
  const summaries = summarizeAccounts(finance);
  const byId = (id: string) => summaries.find((summary) => summary.account.id === id)!;

  it("shows the savings goal and the change since the previous balance on savings accounts", () => {
    expect(accountInsight(byId("savings"), { savingsTarget: 300 })).toEqual({
      change: byId("savings").trend,
      savingsTarget: 300,
    });
  });

  it("shows only the change on spending accounts, once there are two balances", () => {
    expect(accountInsight(byId("spending"), { savingsTarget: 300 })).toEqual({
      change: null,
      savingsTarget: null,
    });
    const twoBalances: AccountSummary = {
      ...byId("spending"),
      trend: {
        latest: { date: "2026-10-10", amount: 400 },
        previous: { date: "2026-10-01", amount: 650 },
        delta: -250,
      },
    };
    expect(accountInsight(twoBalances, { savingsTarget: 300 })).toEqual({
      change: twoBalances.trend,
      savingsTarget: null,
    });
  });

  it("leaves bills accounts to the coverage comparison", () => {
    expect(accountInsight(byId("primary"), { savingsTarget: 300 })).toEqual({
      change: null,
      savingsTarget: null,
    });
  });
});

describe("pendingInBudgetMonth", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [template("rent", 700, 1), template("gym", 30, 12), template("phone", 20.5, 28)],
    overrides: [
      {
        id: "ovr:rent:2026-10-01",
        userId: "demo",
        templateId: "rent",
        occurrenceDate: "2026-10-01",
        status: "paid",
        paidAt: at,
        updatedAt: at,
      },
      {
        id: "ovr:gym:2026-10-12",
        userId: "demo",
        templateId: "gym",
        occurrenceDate: "2026-10-12",
        status: "skipped",
        updatedAt: at,
      },
    ],
  };

  it("uses the same rule as Gastos' 'Por pagar'", () => {
    const occurrences = occurrencesForMonth(store, new Date(2026, 9, 1), "es");

    expect(pendingInBudgetMonth(store, "2026-10", CALENDAR_CYCLE, "es")).toBe(20.5);
    expect(pendingInBudgetMonth(store, "2026-10", CALENDAR_CYCLE, "es")).toBe(
      monthPendingSummary(occurrences, "2026-10").total,
    );
  });

  it("follows the payday cycle's days", () => {
    const payday: BudgetCycle = {
      anchor: "payday",
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: at } },
    };
    // Del 28 de octubre al 27 de noviembre: el teléfono del 28, el alquiler y
    // el gimnasio de noviembre.
    expect(pendingInBudgetMonth(store, "2026-11", payday, "es")).toBe(750.5);
  });
});
