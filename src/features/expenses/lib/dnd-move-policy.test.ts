import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { canMoveOccurrence, isDropTargetAllowed, resolveDragMove } from "./dnd-move-policy";

function occurrence(dueDate: string, record = false): ExpenseOccurrence {
  return {
    id: `rent:${dueDate}`,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "",
    status: "due",
    sortOrder: 0,
    template: {
      id: "rent",
      userId: "demo",
      name: "Rent",
      description: "",
      amount: 700,
      currency: "EUR",
      categoryId: "home",
      startDate: "2026-01-01",
      dueDay: Number(dueDate.slice(8, 10)),
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    record: record ? ({ id: "record" } as ExpenseOccurrence["record"]) : undefined,
  };
}

describe("resolveDragMove", () => {
  const currentMonth = "2026-11";

  it("never drops into a closed month", () => {
    expect(
      resolveDragMove({
        occurrence: occurrence("2026-11-05"),
        target: { date: "2026-10-30" },
        currentMonth,
      }),
    ).toBe("ignore");
    expect(isDropTargetAllowed({ date: "2026-10-30", position: "before" }, currentMonth))
      .toBe(false);
  });

  it("moves only that bill when it comes from last month or a record", () => {
    expect(
      resolveDragMove({
        occurrence: occurrence("2026-10-28"),
        target: { date: "2026-11-03" },
        currentMonth,
      }),
    ).toBe("single");
    expect(
      resolveDragMove({
        occurrence: occurrence("2026-11-05", true),
        target: { date: "2026-11-08" },
        currentMonth,
      }),
    ).toBe("single");
  });

  it("keeps the series flow for current-month bills and ignores no-op drops", () => {
    expect(
      resolveDragMove({
        occurrence: occurrence("2026-11-05"),
        target: { date: "2026-11-08" },
        currentMonth,
      }),
    ).toBe("series");
    expect(
      resolveDragMove({
        occurrence: occurrence("2026-11-05"),
        target: { date: "2026-11-05" },
        currentMonth,
      }),
    ).toBe("ignore");
  });

  it("never drops into a closed month while looking at a past month", () => {
    const octoberBill = occurrence("2026-10-03");
    const viewing = { currentMonth: "2026-09", openMonth: "2026-10" };

    expect(
      resolveDragMove({ occurrence: octoberBill, target: { date: "2026-09-15", rowId: undefined }, ...viewing }),
    ).toBe("ignore");
    expect(isDropTargetAllowed({ date: "2026-09-15" }, "2026-09", "2026-10")).toBe(false);
    expect(isDropTargetAllowed({ date: "2026-10-05" }, "2026-09", "2026-10")).toBe(true);
  });

  it("does not move paid history from a closed month", () => {
    const paidSeptember = { ...occurrence("2026-09-01", true), status: "paid" as const };
    const unpaidSeptember = occurrence("2026-09-20");

    expect(
      resolveDragMove({
        occurrence: paidSeptember,
        target: { date: "2026-10-05", rowId: undefined },
        currentMonth: "2026-09",
        openMonth: "2026-10",
      }),
    ).toBe("ignore");
    expect(
      resolveDragMove({
        occurrence: unpaidSeptember,
        target: { date: "2026-10-05", rowId: undefined },
        currentMonth: "2026-10",
        openMonth: "2026-10",
      }),
    ).toBe("single");
  });

  it("uses the first open day of a payday cycle as the floor", () => {
    const bill = occurrence("2026-11-05");
    const viewing = { currentMonth: "2026-11", openMonth: "2026-10", floorDate: "2026-10-28" };

    expect(isDropTargetAllowed({ date: "2026-10-30" }, "2026-11", "2026-10", "2026-10-28")).toBe(
      true,
    );
    expect(isDropTargetAllowed({ date: "2026-10-27" }, "2026-11", "2026-10", "2026-10-28")).toBe(
      false,
    );
    expect(
      resolveDragMove({ occurrence: bill, target: { date: "2026-10-30", rowId: undefined }, ...viewing }),
    ).not.toBe("ignore");
    expect(
      resolveDragMove({ occurrence: bill, target: { date: "2026-10-20", rowId: undefined }, ...viewing }),
    ).toBe("ignore");
  });
});

describe("canMoveOccurrence", () => {
  const occurrence = (dueDate: string, status: "due" | "paid") =>
    ({ dueDate, status }) as Parameters<typeof canMoveOccurrence>[0];

  it("keeps paid charges of a closed month as history", () => {
    expect(canMoveOccurrence(occurrence("2026-09-08", "paid"), "2026-10")).toBe(false);
    expect(canMoveOccurrence(occurrence("2026-09-08", "due"), "2026-10")).toBe(true);
    expect(canMoveOccurrence(occurrence("2026-10-08", "paid"), "2026-10")).toBe(true);
  });
});
