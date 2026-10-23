import { describe, expect, it } from "vitest";
import type { BudgetCycle } from "@/domain/budget-cycle";
import {
  clampViewMonth,
  cycleDropFloorDate,
  formatMonthName,
  formatPeriodRange,
} from "./month-view";

describe("month view", () => {
  it("keeps the viewed month between a year back and the next month", () => {
    expect(clampViewMonth("2026-10", "2026-11")).toBe("2026-10");
    expect(clampViewMonth("2027-02", "2026-11")).toBe("2026-12");
    expect(clampViewMonth("2024-01", "2026-11")).toBe("2025-11");
  });

  it("names months in the app language", () => {
    expect(formatMonthName("2026-11", "es")).toBe("noviembre");
    expect(formatMonthName("2026-11", "en", { withYear: true })).toBe("November 2026");
  });

  it("labels a payday cycle with its first and last day", () => {
    expect(formatPeriodRange({ start: "2026-10-28", end: "2026-11-27" }, "es")).toBe(
      "28 oct – 27 nov",
    );
  });

  it("only lets a drag land inside the open cycle and calendar month", () => {
    const cycle: BudgetCycle = {
      anchor: "payday",
      monthlySalary: { "2026-01": { amount: 2000, dayOfMonth: 28 } },
    };

    // El 29 de octubre ya es "noviembre" (28 oct - 27 nov).
    expect(
      cycleDropFloorDate({
        viewMonthId: "2026-11",
        calendarMonthId: "2026-11",
        today: "2026-10-29",
        cycle,
      }),
    ).toBe("2026-10-28");
    // El 2 de noviembre octubre ya está cerrado.
    expect(
      cycleDropFloorDate({
        viewMonthId: "2026-11",
        calendarMonthId: "2026-11",
        today: "2026-11-02",
        cycle,
      }),
    ).toBe("2026-11-01");
    // Mirando el ciclo siguiente no se suelta antes de que empiece.
    expect(
      cycleDropFloorDate({
        viewMonthId: "2026-12",
        calendarMonthId: "2026-11",
        today: "2026-10-29",
        cycle,
      }),
    ).toBe("2026-11-28");
  });
});
