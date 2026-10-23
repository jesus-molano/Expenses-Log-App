import { describe, expect, it } from "vitest";
import type { ExpenseOccurrence } from "@/domain/types";
import { statusLabel } from "./expense-actions";
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

describe("timeline for a viewed month", () => {
  const paid = (item: ExpenseOccurrence): ExpenseOccurrence => ({ ...item, status: "paid" });

  it("titles days of another month with the month", () => {
    const sections = buildTimelineSections(
      [occurrence("gym", "2026-10-30", 30), occurrence("rent", "2026-11-03", 700)],
      "2026-10-28",
      "es",
      "2026-10",
    );

    expect(sections.map((section) => section.title)).toEqual([
      "Hoy",
      "viernes 30",
      "martes 3 nov",
    ]);
  });

  it("puts next month's prepaid bills at the end instead of on top", () => {
    const sections = buildTimelineSections(
      [
        paid(occurrence("power", "2026-10-12", 60)),
        occurrence("gym", "2026-10-30", 30),
        paid(occurrence("rent", "2026-11-01", 700)),
        paid(occurrence("insurance", "2026-11-15", 90)),
      ],
      "2026-10-28",
      "es",
      "2026-10",
    );

    expect(sections.map((section) => section.id)).toEqual([
      "paid-2026-10-12",
      "today",
      "future-2026-10-30",
      "paid-ahead-2026-11",
    ]);
    const paidAhead = sections.at(-1)!;
    expect(paidAhead).toMatchObject({
      title: "Ya pagado de noviembre",
      muted: true,
      total: 0,
    });
    expect(paidAhead.items.map((item) => item.id)).toEqual(["rent", "insurance"]);
  });

  it("shows Today only in the calendar month", () => {
    // Septiembre visto el 3 de octubre: lo de hoy es un día más, con su mes.
    const september = buildTimelineSections(
      [occurrence("rent", "2026-10-03", 700)],
      "2026-10-03",
      "es",
      "2026-09",
    );
    expect(september.some((section) => section.id === "today")).toBe(false);
    expect(september[0].title).toBe("sábado 3 oct");

    // Noviembre visto el 28 de octubre: en lugar de Hoy, cuánto falta.
    const november = buildTimelineSections([], "2026-10-28", "es", "2026-11");
    // La cabecera pone la mayúscula inicial.
    expect(november.map((section) => section.title)).toEqual(["noviembre empieza en 4 días"]);
  });

  it("groups last month's unpaid bills as carry-over when looking ahead", () => {
    const sections = buildTimelineSections(
      [occurrence("internet", "2026-10-20", 30), occurrence("rent", "2026-11-01", 700)],
      "2026-10-28",
      "es",
      "2026-11",
    );

    expect(sections[0]).toMatchObject({
      id: "carry-over-2026-10",
      title: "Pendiente de octubre",
    });
  });

  it("keeps the month's own overdue bills as overdue in a past month", () => {
    const sections = buildTimelineSections(
      [occurrence("internet", "2026-09-20", 30)],
      "2026-10-28",
      "es",
      "2026-09",
    );

    expect(sections.map((section) => section.id)).toEqual(["overdue"]);
  });

  it("adds the month to a weekend estimate that falls in the next month", () => {
    const weekend = {
      ...occurrence("gym", "2026-10-31", 30),
      estimatedChargeDate: "2026-11-02",
    };

    expect(statusLabel(weekend, "2026-10-28", "es")).toBe("estimado lunes 2 nov");
    // El domingo 1 se carga el lunes 2: mismo mes, sin repetirlo.
    expect(statusLabel({ ...weekend, dueDate: "2026-11-01" }, "2026-10-28", "es")).toBe(
      "estimado lunes 2",
    );
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
