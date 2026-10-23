import { describe, expect, it } from "vitest";
import { occurrencesDueBetween } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  moveOccurrenceInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
} from "@/stores/app/expense-commands";
import {
  buildLeftoverRows,
  leftoverMoveDate,
  leftoverResolution,
  snapshotLeftovers,
} from "./month-close";

const store: ExpenseStore = {
  ...emptyStore,
  templates: [template("internet", 20), template("gym", 30), template("power", 25)],
};
const october = () => occurrencesDueBetween(store, "2026-10-01", "2026-10-31");

describe("month close leftovers", () => {
  it("moves a leftover to the 1st of next month, across years", () => {
    expect(leftoverMoveDate("2026-10")).toBe("2026-11-01");
    expect(leftoverMoveDate("2026-12")).toBe("2027-01-01");
  });

  it("reads what happened to each leftover from the store", () => {
    const [internet, power, gym] = october();
    let next = togglePaidInStore(store, internet);
    next = skipOccurrenceInStore(next, gym);
    next = moveOccurrenceInStore(next, power, leftoverMoveDate("2026-10"));
    const current = occurrencesDueBetween(next, "2026-10-01", "2026-11-30");
    const byId = (id: string) => current.find((item) => item.id === id)!;

    expect(leftoverResolution(byId(internet.id), "2026-10")).toBe("paid");
    expect(leftoverResolution(byId(gym.id), "2026-10")).toBe("skipped");
    expect(leftoverResolution(byId(power.id), "2026-10")).toBe("moved");
    expect(leftoverResolution(october()[0], "2026-10")).toBe("pending");
  });

  it("keeps the rows of the snapshot in order and drops deleted expenses", () => {
    const snapshot = snapshotLeftovers(october());
    const [internet] = october();
    const paid = togglePaidInStore(store, internet);
    const withoutGym: ExpenseStore = {
      ...paid,
      templates: paid.templates.filter((item) => item.id !== "gym"),
    };

    const rows = buildLeftoverRows(
      snapshot,
      occurrencesDueBetween(withoutGym, "2026-10-01", "2026-11-30"),
      "2026-10",
    );

    expect(rows.map((row) => [row.snapshot.id, row.resolution])).toEqual([
      ["internet:2026-10-20", "paid"],
      ["power:2026-10-25", "pending"],
    ]);
    expect(rows[1].snapshot.dueDate).toBe("2026-10-25");
  });
});

function template(id: string, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 30,
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
