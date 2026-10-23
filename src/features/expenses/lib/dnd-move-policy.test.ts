import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { isDropTargetAllowed, resolveDragMove } from "./dnd-move-policy";

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
});
