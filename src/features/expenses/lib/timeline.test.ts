import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { buildTimelineSections } from "./timeline";

describe("timeline sections", () => {
  it("labels the overdue group as an aggregate instead of a shared date", () => {
    const sections = buildTimelineSections(
      [
        occurrence("icloud", "2026-06-01", 3.99),
        occurrence("movistar", "2026-06-08", 60),
      ],
      "2026-06-13",
      "es",
    );

    const overdue = sections.find((section) => section.id === "overdue");

    expect(overdue?.title).toBe("Atrasado");
    expect(overdue?.subtitle).toBe("Aún sin pagar");
    expect(overdue?.subtitle).not.toContain("lunes 1");
    expect(overdue?.items.map((item) => item.id)).toEqual(["icloud", "movistar"]);
    expect(overdue?.total).toBe(63.99);
  });

  it("does not call a weekend due date overdue until the bank charge day passes", () => {
    // Vence el sábado 31 y el banco lo carga el lunes 2.
    const weekend = {
      ...occurrence("gym", "2026-10-31", 30),
      estimatedChargeDate: "2026-11-02",
    };
    const sectionOn = (today: string) =>
      buildTimelineSections([weekend], today, "es").find(
        (section) => section.items.length > 0,
      )!;

    expect(sectionOn("2026-11-01").id).toBe("future-2026-10-31");
    expect(sectionOn("2026-11-02").id).toBe("today");
    expect(sectionOn("2026-11-03").id).toBe("carry-over-2026-10");
  });
});

function occurrence(
  id: string,
  dueDate: string,
  amount: number,
): ExpenseOccurrence {
  return {
    id,
    occurrenceDate: dueDate,
    dueDate,
    estimatedChargeDate: dueDate,
    estimatedChargeLabel: "",
    status: "due",
    sortOrder: 0,
    template: {
      id,
      userId: "demo",
      name: id,
      description: "",
      amount,
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
