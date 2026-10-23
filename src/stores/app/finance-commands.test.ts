import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import {
  deleteBalanceCheckinInStore,
  recordBalanceInStore,
  timestampAfter,
  updateBudgetCycleInStore,
} from "./finance-commands";

describe("updateBudgetCycleInStore", () => {
  it("stores the choice with the time it was made", () => {
    const store = updateBudgetCycleInStore(
      emptyStore,
      "payday",
      new Date("2026-10-20T10:00:00.000Z"),
    );

    expect(store.finance.budgetCycle).toEqual({
      anchor: "payday",
      updatedAt: "2026-10-20T10:00:00.000Z",
    });
  });

  it("does nothing when the choice does not change", () => {
    expect(updateBudgetCycleInStore(emptyStore, "calendar")).toBe(emptyStore);
    const payday = updateBudgetCycleInStore(emptyStore, "payday");
    expect(updateBudgetCycleInStore(payday, "payday")).toBe(payday);
  });

  it("keeps going back to the calendar month newer than the previous choice on a slow clock", () => {
    const payday = updateBudgetCycleInStore(
      emptyStore,
      "payday",
      new Date("2026-10-20T10:00:00.000Z"),
    );
    // Otro dispositivo con el reloj atrasado vuelve al mes natural.
    const calendar = updateBudgetCycleInStore(
      payday,
      "calendar",
      new Date("2026-10-20T09:00:00.000Z"),
    );

    expect(calendar.finance.budgetCycle?.anchor).toBe("calendar");
    expect(calendar.finance.budgetCycle!.updatedAt > payday.finance.budgetCycle!.updatedAt)
      .toBe(true);
  });
});

describe("timestampAfter", () => {
  it("uses now unless the previous change is later", () => {
    const now = new Date("2026-10-20T10:00:00.000Z");
    expect(timestampAfter(undefined, now)).toBe("2026-10-20T10:00:00.000Z");
    expect(timestampAfter("nope", now)).toBe("2026-10-20T10:00:00.000Z");
    expect(timestampAfter("2026-10-19T10:00:00.000Z", now)).toBe("2026-10-20T10:00:00.000Z");
    expect(timestampAfter("2026-10-21T10:00:00.000Z", now)).toBe("2026-10-21T10:00:00.001Z");
  });
});

describe("balance log commands", () => {
  const at = (iso: string) => new Date(iso);

  it("records one balance per day, rounded to cents", () => {
    const first = recordBalanceInStore(
      emptyStore,
      { date: "2026-10-23", amount: 1250.404 },
      at("2026-10-23T10:00:00.000Z"),
    );
    const replaced = recordBalanceInStore(
      first,
      { date: "2026-10-23", amount: -35 },
      at("2026-10-23T18:00:00.000Z"),
    );

    expect(first.finance.balanceCheckins).toEqual({
      "2026-10-23": { amount: 1250.4, updatedAt: "2026-10-23T10:00:00.000Z" },
    });
    expect(replaced.finance.balanceCheckins).toEqual({
      "2026-10-23": { amount: -35, updatedAt: "2026-10-23T18:00:00.000Z" },
    });
  });

  it("ignores impossible dates and amounts", () => {
    expect(recordBalanceInStore(emptyStore, { date: "2026-02-30", amount: 10 })).toBe(emptyStore);
    expect(recordBalanceInStore(emptyStore, { date: "2026-10-23", amount: Number.NaN })).toBe(
      emptyStore,
    );
  });

  it("deletes by marking the day, and recording it again brings it back", () => {
    const recorded = recordBalanceInStore(
      emptyStore,
      { date: "2026-10-23", amount: 500 },
      at("2026-10-23T10:00:00.000Z"),
    );
    // Reloj atrasado: el borrado queda igualmente después.
    const deleted = deleteBalanceCheckinInStore(recorded, "2026-10-23", at("2026-10-23T09:00:00.000Z"));
    const restored = recordBalanceInStore(
      deleted,
      { date: "2026-10-23", amount: 500 },
      at("2026-10-23T11:00:00.000Z"),
    );

    expect(deleted.finance.balanceCheckins?.["2026-10-23"]).toEqual({
      amount: 500,
      updatedAt: "2026-10-23T10:00:00.001Z",
      deletedAt: "2026-10-23T10:00:00.001Z",
    });
    expect(deleteBalanceCheckinInStore(deleted, "2026-10-23")).toBe(deleted);
    expect(deleteBalanceCheckinInStore(emptyStore, "2026-10-23")).toBe(emptyStore);
    expect(restored.finance.balanceCheckins?.["2026-10-23"]).toEqual({
      amount: 500,
      updatedAt: "2026-10-23T11:00:00.000Z",
    });
  });
});
