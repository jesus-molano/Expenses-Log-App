import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCaptureCommand, type CaptureCommand } from "@/domain/capture-commands";
import { occurrencesDueBetween } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  applyCaptureCommandsInStore,
  paidOtherAmounts,
  revertCaptureCommandsInStore,
} from "./capture-command-actions";

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

const base: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("luz", "Luz", 8, 60),
    template("gym", "Gimnasio", 1, 35),
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

const resolve = (store: ExpenseStore, command: CaptureCommand) =>
  resolveCaptureCommand(command, store, { today: "2026-10-23", monthId: "2026-10" });

function october(store: ExpenseStore) {
  return Object.fromEntries(
    occurrencesDueBetween(store, "2026-10-01", "2026-10-31").map((occurrence) => [
      occurrence.template.id,
      {
        status: occurrence.status,
        dueDate: occurrence.dueDate,
        amountPaid: occurrence.override?.amountPaid,
      },
    ]),
  );
}

describe("capture command actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pays, skips and moves with the usual commands, and undoes all of it", () => {
    const { store, changes } = applyCaptureCommandsInStore(base, [
      { resolved: resolve(base, cmd("pay", "luz", { amount: 71.2 })) },
      { resolved: resolve(base, cmd("skip", "gimnasio")) },
      { resolved: resolve(base, cmd("move", "netflix", { day: 10 })) },
    ]);

    expect(changes).toHaveLength(3);
    expect(october(store)).toEqual({
      luz: { status: "paid", dueDate: "2026-10-08", amountPaid: 71.2 },
      gym: { status: "skipped", dueDate: "2026-10-01", amountPaid: undefined },
      netflix: { status: "due", dueDate: "2026-10-10", amountPaid: undefined },
    });
    // Mover solo este cobro no cambia la serie.
    expect(store.templates.find((item) => item.id === "netflix")?.dueDay).toBe(28);

    const reverted = revertCaptureCommandsInStore(store, changes);
    expect(october(reverted)).toEqual(october(base));
  });

  it("lets the user correct the paid amount in the review", () => {
    const { store } = applyCaptureCommandsInStore(base, [
      { resolved: resolve(base, cmd("pay", "luz")), amount: 64.75 },
    ]);
    expect(october(store).luz).toMatchObject({ status: "paid", amountPaid: 64.75 });
  });

  it("moves the whole series when chosen and restores its day on undo", () => {
    const { store, changes } = applyCaptureCommandsInStore(base, [
      { resolved: resolve(base, cmd("move", "netflix", { day: 10 })), scope: "series" },
    ]);

    expect(store.templates.find((item) => item.id === "netflix")?.dueDay).toBe(10);
    expect(october(store).netflix).toMatchObject({ dueDate: "2026-10-10" });
    expect(changes[0].previousDueDay).toBe(28);

    const reverted = revertCaptureCommandsInStore(store, changes);
    expect(reverted.templates.find((item) => item.id === "netflix")?.dueDay).toBe(28);
    expect(october(reverted).netflix).toMatchObject({ status: "due", dueDate: "2026-10-28" });
  });

  it("restores a previous payment instead of leaving it unpaid", () => {
    const paid = applyCaptureCommandsInStore(base, [
      { resolved: resolve(base, cmd("pay", "luz", { amount: 60 })) },
    ]).store;
    const { store, changes } = applyCaptureCommandsInStore(paid, [
      { resolved: resolve(paid, cmd("pay", "luz", { amount: 71.2 })) },
    ]);
    expect(october(store).luz.amountPaid).toBe(71.2);

    expect(october(revertCaptureCommandsInStore(store, changes)).luz).toEqual({
      status: "paid",
      dueDate: "2026-10-08",
      amountPaid: 60,
    });
  });

  it("does not apply commands with a problem", () => {
    const result = applyCaptureCommandsInStore(base, [
      { resolved: resolve(base, cmd("pay", "agua")) },
      { resolved: resolve(base, cmd("move", "luz")) },
    ]);
    expect(result).toEqual({ store: base, changes: [] });
  });

  it("lists the payments of another amount, to ask about the next charges", () => {
    expect(
      paidOtherAmounts([
        { resolved: resolve(base, cmd("pay", "luz", { amount: 71.2 })) },
        // Corregido en la revisión: cuenta lo corregido.
        { resolved: resolve(base, cmd("pay", "gimnasio", { amount: 30 })), amount: 35 },
        { resolved: resolve(base, cmd("pay", "netflix")), amount: 13.99 },
        { resolved: resolve(base, cmd("skip", "luz")) },
        { resolved: resolve(base, cmd("pay", "agua", { amount: 10 })) },
      ]),
    ).toEqual([
      { templateId: "luz", amount: 71.2 },
      { templateId: "netflix", amount: 13.99 },
    ]);
  });
});
