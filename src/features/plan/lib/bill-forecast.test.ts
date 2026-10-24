import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";
import { buildLargeUpcomingBills, buildProvisionPlan } from "./bill-forecast";

const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Atlantic/Canary";
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
});

describe("buildProvisionPlan", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [
      template("rent", 700, "2026-01-01", 1),
      template("insurance", 300, "2026-03-20", 20, { frequency: "yearly", annualMonth: 3 }),
      template("ibi", 150, "2026-01-10", 10, { frequency: "quarterly" }),
      template("car-tax", 120, "2026-11-05", 5, { frequency: "yearly", annualMonth: 11 }),
      template("laptop", 900, "2026-12-05", 5, { frequency: "once" }),
    ],
    overrides: [paid("car-tax", "2026-11-05")],
  };

  it("spreads non-monthly bills over twelve months and paces each next charge", () => {
    const plan = buildProvisionPlan(store, { monthId: "2026-11" });

    expect(plan.annualTotal).toBe(1020);
    expect(plan.monthlyTotal).toBe(85);
    // Lo de cada recibo hasta su fecha: 50 + 60 + 9,23.
    expect(plan.monthlyToSetAside).toBe(119.23);
    expect(
      plan.items.map((item) => [item.template.id, item.annual, item.monthly, item.next]),
    ).toEqual([
      // Enero: noviembre, diciembre y enero para apartarlo.
      ["ibi", 600, 50, { dueDate: "2027-01-10", amount: 150, monthsUntil: 3, perMonthUntilDue: 50 }],
      ["insurance", 300, 25, { dueDate: "2027-03-20", amount: 300, monthsUntil: 5, perMonthUntilDue: 60 }],
      // Ya pagado este mes: el próximo es el del año que viene.
      ["car-tax", 120, 10, { dueDate: "2027-11-05", amount: 120, monthsUntil: 13, perMonthUntilDue: 9.23 }],
    ]);
  });

  it("says when a bill is due in the current month", () => {
    const plan = buildProvisionPlan(store, { monthId: "2027-01" });
    expect(plan.items[0]).toMatchObject({
      template: { id: "ibi" },
      next: { dueDate: "2027-01-10", monthsUntil: 1, perMonthUntilDue: 150 },
    });
    // El IBI de enero ya va en lo que hay que pagar este mes.
    expect(plan.monthlyToSetAside).toBe(
      Math.round(
        plan.items
          .filter((item) => item.next && item.next.monthsUntil > 1)
          .reduce((sum, item) => sum + item.next!.perMonthUntilDue, 0) * 100,
      ) / 100,
    );
  });

  it("is empty without non-monthly bills", () => {
    expect(
      buildProvisionPlan(
        { ...emptyStore, templates: [template("rent", 700, "2026-01-01", 1)] },
        { monthId: "2026-11" },
      ),
    ).toEqual({ monthlyToSetAside: 0, monthlyTotal: 0, annualTotal: 0, items: [] });
  });
});

describe("buildLargeUpcomingBills", () => {
  const store: ExpenseStore = {
    ...emptyStore,
    templates: [
      template("rent", 700, "2026-01-01", 1),
      template("ibi", 150, "2026-01-10", 10, { frequency: "quarterly" }),
      template("laptop", 900, "2026-12-05", 5, { frequency: "once" }),
      template("domain", 15, "2026-12-01", 1, { frequency: "yearly", annualMonth: 12 }),
      template("insurance", 300, "2026-03-20", 20, { frequency: "yearly", annualMonth: 3 }),
      // Vence el sábado 31 de octubre y se cobra el lunes 2 de noviembre.
      template("water", 80, "2026-07-31", 31, { frequency: "quarterly" }),
      template("car-tax", 120, "2026-11-05", 5, { frequency: "yearly", annualMonth: 11 }),
    ],
    overrides: [paid("car-tax", "2026-11-05")],
  };

  it("lists the unpaid non-monthly and one-off bills of the next 90 days", () => {
    const bills = buildLargeUpcomingBills(store, { today: "2026-11-02" });

    expect(bills.items.map((bill) => [bill.name, bill.chargeDate, bill.amount, bill.daysUntil]))
      .toEqual([
        ["water", "2026-11-02", 80, 0],
        // Sábado 5 de diciembre: se cobra el lunes 7.
        ["laptop", "2026-12-07", 900, 35],
        // Domingo 10 de enero: se cobra el lunes 11.
        ["ibi", "2027-01-11", 150, 70],
        // Vence el día 90 (domingo 31 de enero) aunque se cobre el 91.
        ["water", "2027-02-01", 80, 91],
      ]);
    expect(bills.total).toBe(1210);
  });

  it("forgets a bill once its charge day has passed", () => {
    const dueDates = buildLargeUpcomingBills(store, { today: "2026-11-03" }).items.map(
      (bill) => bill.dueDate,
    );
    expect(dueDates).toEqual(["2026-12-05", "2027-01-10", "2027-01-31"]);
  });

  it("can lower the threshold", () => {
    const names = buildLargeUpcomingBills(store, { today: "2026-11-02", minAmount: 10 }).items.map(
      (bill) => bill.name,
    );
    expect(names).toContain("domain");
  });
});

function template(
  id: string,
  amount: number,
  startDate: string,
  dueDay: number,
  recurrence: RecurrenceRule = { frequency: "monthly" },
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function paid(templateId: string, occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}
