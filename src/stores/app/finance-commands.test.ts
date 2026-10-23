import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import { timestampAfter, updateBudgetCycleInStore } from "./finance-commands";

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
