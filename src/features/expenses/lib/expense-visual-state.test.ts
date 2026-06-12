import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import {
  resolveExpenseVisualState,
  timelineDotToneClass,
} from "./expense-visual-state";

describe("expense visual state", () => {
  it("uses one semantic state for cards, badges and timeline dots", () => {
    expect(resolveExpenseVisualState(occurrence({ status: "paid" }), today)).toBe(
      "paid",
    );
    expect(resolveExpenseVisualState(occurrence({ dueDate: "2026-06-10" }), today)).toBe(
      "overdue",
    );
    expect(
      resolveExpenseVisualState(
        occurrence({
          dueDate: "2026-06-20",
          estimatedChargeDate: "2026-06-22",
        }),
        today,
      ),
    ).toBe("estimated");
    expect(resolveExpenseVisualState(occurrence(), today)).toBe("pending");
  });

  it("maps the shared state to the matching timeline dot class", () => {
    expect(timelineDotToneClass("paid")).toBe("app-timeline-dot-paid");
    expect(timelineDotToneClass("overdue")).toBe("app-timeline-dot-critical");
    expect(timelineDotToneClass("estimated")).toBe("app-timeline-dot-estimated");
    expect(timelineDotToneClass("pending")).toBe("");
  });
});

const today = "2026-06-11";

function occurrence(
  overrides: Partial<ExpenseOccurrence> = {},
): ExpenseOccurrence {
  const dueDate = overrides.dueDate ?? "2026-06-26";

  return {
    id: "occ-test",
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: overrides.estimatedChargeDate ?? dueDate,
    estimatedChargeLabel: "",
    status: overrides.status ?? "due",
    sortOrder: 0,
    template: {
      id: "exp-test",
      userId: "demo",
      name: "Test",
      description: "",
      amount: 10,
      currency: "EUR",
      categoryId: "cat-test",
      startDate: dueDate,
      dueDay: Number(dueDate.slice(-2)),
      recurrence: { frequency: "monthly", interval: 1 },
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    ...overrides,
  };
}
