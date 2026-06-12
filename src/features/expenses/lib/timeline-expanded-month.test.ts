import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import {
  getExpandedSectionDays,
  groupMonthItemsByDate,
  visibleSectionsDuringMonthDrag,
} from "./timeline-expanded-month";
import type { TimelineSection } from "./timeline";

function occurrence(id: string, dueDate: string, sortOrder = 0): ExpenseOccurrence {
  return {
    id,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "",
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
      startDate: dueDate,
      dueDay: Number(dueDate.slice(-2)),
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  };
}

function section(id: string, anchorDate: string, items: ExpenseOccurrence[]): TimelineSection {
  return {
    id,
    title: id,
    subtitle: "",
    tone: "pending",
    priority: 1,
    total: 1,
    anchorDate,
    items,
  };
}

describe("timeline expanded month", () => {
  it("expands every day of the dragged occurrence month", () => {
    const dragged = occurrence("game-pass", "2026-06-12");
    const days = getExpandedSectionDays({
      section: section("future-2026-06-12", "2026-06-12", [dragged]),
      draggedOccurrence: dragged,
      currentMonth: "2026-06",
    });

    expect(days[0]).toBe("2026-06-01");
    expect(days.at(-1)).toBe("2026-06-30");
  });

  it("groups all real month items by day and keeps sort order", () => {
    const itemsByDate = groupMonthItemsByDate(
      [
        section("a", "2026-06-12", [occurrence("game-pass", "2026-06-12")]),
        section("b", "2026-06-15", [
          occurrence("dazn", "2026-06-15", 2),
          occurrence("icloud", "2026-06-15", 1),
        ]),
      ],
      "2026-06-01",
    );

    expect(itemsByDate.get("2026-06-15")?.map((item) => item.id)).toEqual([
      "icloud",
      "dazn",
    ]);
  });

  it("hides duplicate same-month sections while dragging", () => {
    const dragged = occurrence("game-pass", "2026-06-12");
    const visible = visibleSectionsDuringMonthDrag({
      currentMonth: "2026-06",
      draggedOccurrence: dragged,
      sections: [
        section("future-2026-06-12", "2026-06-12", [dragged]),
        section("future-2026-06-15", "2026-06-15", [
          occurrence("icloud", "2026-06-15"),
        ]),
        section("future-2026-07-01", "2026-07-01", [
          occurrence("rent", "2026-07-01"),
        ]),
      ],
    });

    expect(visible.map((item) => item.id)).toEqual([
      "future-2026-06-12",
      "future-2026-07-01",
    ]);
  });
});
