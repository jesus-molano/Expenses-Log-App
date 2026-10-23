import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaptureCommand } from "@/domain/capture-commands";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { useCaptureCommandReview } from "./use-capture-command-review";

function template(id: string, name: string, dueDay: number, amount: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "casa",
    startDate: "2026-01-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("luz", "Luz", 8, 60),
    template("coche", "Seguro coche", 15, 420),
    template("hogar", "Seguro hogar", 20, 180),
    template("netflix", "Netflix", 28, 12.99),
  ],
};

const cmd = (intent: CaptureCommand["intent"], target: string, extra: Partial<CaptureCommand> = {}): CaptureCommand => ({
  intent,
  target,
  amount: null,
  day: null,
  date: null,
  month: null,
  ...extra,
});

function setup(commands: CaptureCommand[]) {
  return renderHook(() =>
    useCaptureCommandReview({
      commands,
      store,
      today: "2026-10-23",
      monthId: "2026-10",
      language: "es",
    }),
  );
}

describe("useCaptureCommandReview", () => {
  it("includes what can be applied and leaves out what needs a choice", () => {
    const { result } = setup([cmd("pay", "luz", { amount: 71.2 }), cmd("pay", "seguro")]);
    const [luz, seguro] = result.current.items;

    expect(luz).toMatchObject({ amountText: "71,2", amount: 71.2, applicable: true, included: true });
    expect(seguro).toMatchObject({ applicable: false, included: false });
    expect(seguro.resolved.issue).toBe("ambiguous");
    expect(result.current.confirmed).toHaveLength(1);

    act(() => result.current.chooseTemplate(seguro.id, "coche"));
    expect(result.current.items[1]).toMatchObject({
      applicable: true,
      included: true,
      amount: 420,
      resolved: { templateId: "coche" },
    });
    expect(result.current.confirmed).toHaveLength(2);
  });

  it("does not apply a paid amount it cannot read", () => {
    const { result } = setup([cmd("pay", "luz")]);
    const [luz] = result.current.items;
    expect(luz.amountText).toBe("60");

    act(() => result.current.setAmountText(luz.id, "setenta"));
    expect(result.current.items[0]).toMatchObject({ amount: null, applicable: false });
    expect(result.current.confirmed).toEqual([]);

    act(() => result.current.setAmountText(luz.id, "64,75"));
    expect(result.current.confirmed).toEqual([
      expect.objectContaining({ amount: 64.75, scope: "single" }),
    ]);
  });

  it("lets the user exclude an order and choose to move the whole series", () => {
    const { result } = setup([cmd("move", "netflix", { day: 10 })]);
    const [netflix] = result.current.items;
    expect(netflix.resolved.canMoveSeries).toBe(true);

    act(() => result.current.setScope(netflix.id, "series"));
    expect(result.current.confirmed[0]).toMatchObject({ scope: "series" });

    act(() => result.current.toggle(netflix.id));
    expect(result.current.confirmed).toEqual([]);
    expect(result.current.items[0]).toMatchObject({ applicable: true, included: false });
  });
});
