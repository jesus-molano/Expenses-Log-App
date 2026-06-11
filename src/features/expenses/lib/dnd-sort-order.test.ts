import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { getDropSortOrder } from "./dnd-sort-order";
import type { TimelineSection } from "./timeline";

function occurrence(id: string, sortOrder: number): ExpenseOccurrence {
  return {
    id,
    occurrenceDate: "2026-06-15",
    dueDate: "2026-06-15",
    estimatedChargeDate: "2026-06-15",
    estimatedChargeLabel: "en 4 días",
    status: "due",
    sortOrder,
    template: {
      id,
      userId: "demo",
      name: id,
      description: "",
      amount: 1,
      currency: "EUR",
      categoryId: "cat",
      tags: [],
      startDate: "2026-06-15",
      dueDay: 15,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  };
}

function section(items: ExpenseOccurrence[]): TimelineSection {
  return {
    id: "2026-06-15",
    date: "2026-06-15",
    title: "Lunes 15",
    subtitle: "Pendiente",
    tone: "default",
    total: 1,
    items,
  };
}

describe("getDropSortOrder", () => {
  it("places a moved row between two same-day rows", () => {
    const sections = [
      section([
        occurrence("1password", 0),
        occurrence("dazn", 1024),
        occurrence("icloud", 2048),
      ]),
    ];

    expect(
      getDropSortOrder({
        sections,
        occurrenceId: "icloud",
        target: { rowId: "1password", position: "after" },
      }),
    ).toBe(512);
  });

  it("places a moved row at the top without tying the first row", () => {
    const sections = [
      section([occurrence("1password", 0), occurrence("dazn", 1024)]),
    ];

    expect(
      getDropSortOrder({
        sections,
        occurrenceId: "icloud",
        target: { rowId: "1password", position: "before" },
      }),
    ).toBe(-512);
  });
});
