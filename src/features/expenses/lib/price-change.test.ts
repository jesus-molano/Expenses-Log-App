import { describe, expect, it } from "vitest";
import { activeBudgetMonth, addMonthId, buildMonthPlan } from "@/domain/budget-month";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate, FinanceStore } from "@/domain/types";
import { scheduleAmountChangeInStore, setSeriesAmountInStore } from "@/stores/app/series-commands";
import { priceChangeStart, scheduledPriceChanges } from "./price-change";

function paydayFinance(dayOfMonth: number): FinanceStore {
  return {
    ...emptyStore.finance,
    monthlySalary: { "2026-01": { amount: 2000, dayOfMonth } },
    budgetCycle: { anchor: "payday", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
}

function bill(amount: number, dueDay: number): ExpenseTemplate {
  return {
    id: "bill",
    userId: "demo",
    name: "Bill",
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate: `2026-06-${String(dueDay).padStart(2, "0")}`,
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function planned(store: ExpenseStore, monthId: string, today: string) {
  return buildMonthPlan(store, monthId, { today }).plannedExpensesTotal;
}

// Lo que guarda la hoja al elegir el primer mes que ofrece (el siguiente al activo).
function scheduleFirstChoice(store: ExpenseStore, amount: number, today: string) {
  const firstChoice = addMonthId(activeBudgetMonth(store.finance, today).monthId, 1);
  const from = priceChangeStart(firstChoice, store.finance);
  return {
    from,
    store: scheduleAmountChangeInStore(store, "bill", { from, amount }, new Date(`${today}T10:00:00`)),
  };
}

describe("priceChangeStart", () => {
  it("starts on day 1 with the calendar cycle", () => {
    expect(priceChangeStart("2027-03", emptyStore.finance)).toBe("2027-03-01");
  });

  it("starts on the payday that opens the budget month", () => {
    // Cobro el 5: "diciembre" va del 5 de diciembre al 4 de enero.
    expect(priceChangeStart("2026-12", paydayFinance(5))).toBe("2026-12-05");
    // Cobro el 28: "noviembre" va del 28 de octubre al 27 de noviembre.
    expect(priceChangeStart("2026-11", paydayFinance(28))).toBe("2026-10-28");
  });
});

describe("scheduledPriceChanges", () => {
  it("names each upcoming change after the budget month it starts", () => {
    const changes = [
      { from: "2026-10-01", amount: 12 },
      { from: "2026-10-28", amount: 15 },
      { from: "2027-01-28", amount: 18 },
    ];

    expect(scheduledPriceChanges(changes, "2026-10-20", paydayFinance(28))).toEqual([
      { from: "2026-10-28", amount: 15, monthId: "2026-11" },
      { from: "2027-01-28", amount: 18, monthId: "2027-02" },
    ]);
    expect(scheduledPriceChanges(changes, "2026-10-20", emptyStore.finance)).toEqual([
      { from: "2026-10-28", amount: 15, monthId: "2026-10" },
      { from: "2027-01-28", amount: 18, monthId: "2027-01" },
    ]);
    expect(scheduledPriceChanges(undefined, "2026-10-20", emptyStore.finance)).toEqual([]);
  });
});

describe("scheduling a price for a payday-anchored month", () => {
  it("leaves the active month as it was", () => {
    // Cobro el 5: el mes activo "noviembre" (5 nov - 4 dic) tiene el cobro del 2 de diciembre.
    const today = "2026-11-10";
    const store: ExpenseStore = { ...emptyStore, templates: [bill(30, 2)], finance: paydayFinance(5) };

    const scheduled = scheduleFirstChoice(store, 45, today);

    expect(planned(scheduled.store, "2026-11", today)).toBe(planned(store, "2026-11", today));
    expect(planned(scheduled.store, "2026-11", today)).toBe(30);
    expect(planned(scheduled.store, "2026-12", today)).toBe(45);
    expect(scheduled.from).toBe("2026-12-05");
  });

  it("gives way to a later 'from this month' edit of that month", () => {
    // Cobro el 28: se programa "desde noviembre" el 20 de octubre y, ya en
    // noviembre (desde el 28 de octubre), se cambia el importe desde este mes.
    const store: ExpenseStore = { ...emptyStore, templates: [bill(10, 10)], finance: paydayFinance(28) };
    const scheduled = scheduleFirstChoice(store, 15, "2026-10-20");

    const edited = setSeriesAmountInStore(scheduled.store, "bill", 20, {
      scope: "current",
      today: new Date("2026-10-29T10:00:00"),
    });

    expect(planned(edited, "2026-11", "2026-10-29")).toBe(20);
    expect(planned(edited, "2026-12", "2026-10-29")).toBe(20);
    expect(edited.templates[0].amountChanges).toBeUndefined();
    expect(scheduled.from).toBe("2026-10-28");
  });
});
