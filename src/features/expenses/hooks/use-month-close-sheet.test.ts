import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { monthCloseStatus } from "@/domain/budget-month";
import { emptyFinanceStore, occurrencesDueBetween } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseOccurrence, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  markOccurrencesPaidInStore,
  moveOccurrenceInStore,
  restoreOccurrenceInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
} from "@/stores/app/expense-commands";
import { updateMonthlySavingsContributionInStore } from "@/stores/app/finance-commands";
import { useMonthCloseSheet } from "./use-month-close-sheet";

const initialStore: ExpenseStore = {
  ...emptyStore,
  finance: {
    ...emptyFinanceStore,
    monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 28 } },
    monthlySavingsTargets: { "2026-09": 300 },
  },
  templates: [
    template("rent", 1, 700),
    template("internet", 20, 30),
    template("gym", 30, 45),
  ],
  overrides: [
    {
      id: "ovr:rent:2026-10-01",
      userId: "demo",
      templateId: "rent",
      occurrenceDate: "2026-10-01",
      status: "paid",
      paidAt: "2026-10-01T09:00:00.000Z",
    },
  ],
};

// El store de la prueba se comporta como el real: cada comando lo cambia y
// el hook se vuelve a pintar con el resultado.
function setup() {
  let store = initialStore;
  const onStart = vi.fn();
  const apply = (next: ExpenseStore) => {
    store = next;
  };
  const commands = {
    togglePaid: vi.fn((item: ExpenseOccurrence) => apply(togglePaidInStore(store, item))),
    skipOccurrence: vi.fn((item: ExpenseOccurrence) => apply(skipOccurrenceInStore(store, item))),
    restoreOccurrence: vi.fn((item: ExpenseOccurrence) =>
      apply(restoreOccurrenceInStore(store, item)),
    ),
    moveOccurrence: vi.fn((item: ExpenseOccurrence, dueDate: string) =>
      apply(moveOccurrenceInStore(store, item, dueDate)),
    ),
    markOccurrencesPaid: vi.fn((items: ExpenseOccurrence[]) =>
      apply(markOccurrencesPaidInStore(store, items)),
    ),
    updateMonthlySavingsContribution: vi.fn((input: { monthId: string; amount: number }) =>
      apply(updateMonthlySavingsContributionInStore(store, input)),
    ),
  };
  const hook = renderHook(() =>
    useMonthCloseSheet({
      store,
      monthId: "2026-10",
      today: "2026-10-28",
      language: "es",
      commands,
      onStart,
    }),
  );
  const leftovers = monthCloseStatus(
    occurrencesDueBetween(store, "2026-10-01", "2026-10-31"),
    "2026-10",
  ).leftovers;
  const run = (action: () => void) => {
    act(action);
    hook.rerender();
  };

  return { hook, commands, onStart, leftovers, run, current: () => store };
}

describe("month close sheet", () => {
  it("opens with the leftovers, the plan of the month and the savings goal", () => {
    const { hook, leftovers, run } = setup();

    expect(hook.result.current.isOpen).toBe(false);
    run(() => hook.result.current.open(leftovers));

    expect(hook.result.current.rows.map((row) => [row.occurrence.id, row.resolution])).toEqual([
      ["internet:2026-10-20", "pending"],
      ["gym:2026-10-30", "pending"],
    ]);
    expect(hook.result.current.plan).toMatchObject({
      phase: "current",
      pendingExpenseCount: 2,
      pendingExpensesTotal: 75,
      incomeTotal: 2000,
    });
    expect(hook.result.current.savingsTarget).toBe(300);
  });

  it("resolves each leftover and undoes it from its row", () => {
    const { hook, leftovers, run, commands, current } = setup();
    run(() => hook.result.current.open(leftovers));

    const [internet, gym] = hook.result.current.rows;
    run(() => hook.result.current.move(gym));
    expect(commands.moveOccurrence).toHaveBeenCalledWith(gym.occurrence, "2026-11-01");
    run(() => hook.result.current.pay(internet));

    expect(hook.result.current.rows.map((row) => row.resolution)).toEqual(["paid", "moved"]);
    expect(hook.result.current.plan?.pendingExpenseCount).toBe(0);

    run(() => hook.result.current.undo(hook.result.current.rows[1]));
    expect(hook.result.current.rows[1]).toMatchObject({ resolution: "pending" });
    expect(current().overrides.find((item) => item.templateId === "gym")?.dueDate).toBeUndefined();

    run(() => hook.result.current.skip(hook.result.current.rows[1]));
    expect(hook.result.current.rows[1].resolution).toBe("skipped");
    run(() => hook.result.current.undo(hook.result.current.rows[1]));
    expect(hook.result.current.rows[1].resolution).toBe("pending");
  });

  it("pays everything left in one change", () => {
    const { hook, leftovers, run, commands } = setup();
    run(() => hook.result.current.open(leftovers));
    run(() => hook.result.current.payAll());

    expect(commands.markOccurrencesPaid).toHaveBeenCalledTimes(1);
    expect(hook.result.current.rows.every((row) => row.resolution === "paid")).toBe(true);
  });

  it("records the savings and starts next month", () => {
    const { hook, leftovers, run, commands, onStart, current } = setup();
    run(() => hook.result.current.open(leftovers));

    run(() => hook.result.current.setSavingsText("abc"));
    expect(hook.result.current.savingsInvalid).toBe(true);
    let started = true;
    run(() => {
      started = hook.result.current.start();
    });
    expect(started).toBe(false);
    expect(onStart).not.toHaveBeenCalled();

    run(() => hook.result.current.setSavingsText("250,50"));
    run(() => {
      started = hook.result.current.start();
    });

    expect(started).toBe(true);
    expect(commands.updateMonthlySavingsContribution).toHaveBeenCalledWith({
      monthId: "2026-10",
      amount: 250.5,
    });
    expect(current().finance.monthlySavingsContributions?.["2026-10"]?.amount).toBe(250.5);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("2026-10");
    expect(hook.result.current.isOpen).toBe(false);
  });

  it("leaves the savings untouched when the field is empty or unchanged", () => {
    const { hook, leftovers, run, commands, onStart } = setup();
    run(() => hook.result.current.open(leftovers));
    run(() => {
      hook.result.current.start();
    });

    expect(commands.updateMonthlySavingsContribution).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("keeps the month it was opened for when the calendar moves on", () => {
    let monthId = "2026-10";
    const onStart = vi.fn();
    const noop = vi.fn();
    const hook = renderHook(() =>
      useMonthCloseSheet({
        store: initialStore,
        monthId,
        today: "2026-10-31",
        language: "es",
        commands: {
          togglePaid: noop,
          skipOccurrence: noop,
          restoreOccurrence: noop,
          moveOccurrence: noop,
          markOccurrencesPaid: noop,
          updateMonthlySavingsContribution: noop,
        },
        onStart,
      }),
    );
    const leftovers = monthCloseStatus(
      occurrencesDueBetween(initialStore, "2026-10-01", "2026-10-31"),
      "2026-10",
    ).leftovers;

    act(() => hook.result.current.open(leftovers));
    // Pasa la medianoche del 31 con la hoja abierta.
    monthId = "2026-11";
    hook.rerender();

    expect(hook.result.current.monthId).toBe("2026-10");
    expect(hook.result.current.rows.map((row) => row.resolution)).toEqual(["pending", "pending"]);
    act(() => {
      hook.result.current.start();
    });
    expect(onStart).toHaveBeenCalledWith("2026-10");
  });
});

function template(id: string, dueDay: number, amount: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "home",
    startDate: "2026-10-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}
