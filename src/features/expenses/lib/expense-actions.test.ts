import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { statusLabel } from "./expense-actions";

function occurrence(
  dueDate: string,
  overrides: Partial<ExpenseOccurrence> = {},
): ExpenseOccurrence {
  return {
    id: `luz:${dueDate}`,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "",
    status: "due",
    sortOrder: 0,
    template: {
      id: "luz",
      userId: "demo",
      name: "Luz",
      description: "",
      amount: 64.75,
      currency: "EUR",
      categoryId: "cat-home",
      startDate: "2026-01-08",
      dueDay: 8,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("statusLabel", () => {
  it("counts days late and ahead with the singular for one day", () => {
    expect(statusLabel(occurrence("2026-10-20"), "2026-10-23", "es")).toBe("hace 3 días");
    expect(statusLabel(occurrence("2026-10-22"), "2026-10-23", "es")).toBe("hace 1 día");
    expect(statusLabel(occurrence("2026-10-26"), "2026-10-23", "es")).toBe("en 3 días");
    expect(statusLabel(occurrence("2026-10-20"), "2026-10-23", "en")).toBe("3 days ago");
    expect(statusLabel(occurrence("2026-10-24"), "2026-10-23", "en")).toBe("in 1 day");
  });

  it("says paid or due today before counting days", () => {
    expect(
      statusLabel(occurrence("2026-10-20", { status: "paid" }), "2026-10-23", "es"),
    ).toBe("pagado");
    expect(statusLabel(occurrence("2026-10-23"), "2026-10-23", "en")).toBe("due today");
  });
});
