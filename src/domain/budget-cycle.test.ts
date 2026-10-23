import { addDays, format, parseISO } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CALENDAR_CYCLE,
  configuredPayday,
  cyclePayday,
  periodIdOf,
  periodRange,
  periodStart,
  resolveBudgetCycle,
  type BudgetCycle,
} from "./budget-cycle";
import { emptyFinanceStore } from "./finance";
import type { FinanceStore } from "./types";

function salary(amount: number, dayOfMonth: number) {
  return { amount, dayOfMonth, updatedAt: "2026-01-01T00:00:00.000Z" };
}

function paydayCycle(monthlySalary: FinanceStore["monthlySalary"]): BudgetCycle {
  return { anchor: "payday", monthlySalary };
}

function nextDay(date: string) {
  return format(addDays(parseISO(date), 1), "yyyy-MM-dd");
}

describe("budget cycle", () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Atlantic/Canary";
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it("uses calendar months by default", () => {
    expect(periodRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(periodIdOf("2026-10-31")).toBe("2026-10");
    expect(periodIdOf("2026-11-01", CALENDAR_CYCLE)).toBe("2026-11");
  });

  it("only anchors to payday when chosen and a salary is configured", () => {
    expect(resolveBudgetCycle(emptyFinanceStore)).toBe(CALENDAR_CYCLE);
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      monthlySalary: { "2026-10": salary(2200, 28) },
      budgetCycle: { anchor: "payday", updatedAt: "2026-10-20T10:00:00.000Z" },
    };
    const cycle = resolveBudgetCycle(finance);
    expect(cycle.anchor).toBe("payday");
    expect(cyclePayday(cycle, "2026-10")).toBe(28);
    // Antes del primer sueldo no hay día de cobro: ese mes es natural.
    expect(cyclePayday(cycle, "2026-09")).toBeNull();
    expect(
      resolveBudgetCycle({ ...finance, budgetCycle: { anchor: "calendar", updatedAt: "x" } }),
    ).toBe(CALENDAR_CYCLE);
  });

  it("names a late-payday cycle after the month that holds most of its days", () => {
    const cycle = paydayCycle({ "2026-01": salary(2200, 28) });

    expect(periodRange("2026-11", cycle)).toEqual({ start: "2026-10-28", end: "2026-11-27" });
    expect(periodIdOf("2026-10-27", cycle)).toBe("2026-10");
    expect(periodIdOf("2026-10-28", cycle)).toBe("2026-11");
    expect(periodIdOf("2026-11-27", cycle)).toBe("2026-11");
    expect(periodIdOf("2026-11-28", cycle)).toBe("2026-12");
  });

  it("names an early-payday cycle after the month it starts in", () => {
    const cycle = paydayCycle({ "2026-01": salary(1800, 5) });

    expect(periodRange("2026-11", cycle)).toEqual({ start: "2026-11-05", end: "2026-12-04" });
    expect(periodIdOf("2026-11-04", cycle)).toBe("2026-10");
    expect(periodIdOf("2026-11-05", cycle)).toBe("2026-11");
    expect(periodIdOf("2026-12-04", cycle)).toBe("2026-11");
  });

  it("splits at the 16th: day 15 is early and day 16 is late", () => {
    expect(periodStart("2026-11", paydayCycle({ "2026-01": salary(1, 15) }))).toBe("2026-11-15");
    expect(periodStart("2026-11", paydayCycle({ "2026-01": salary(1, 16) }))).toBe("2026-10-16");
  });

  it("treats payday 1 like the calendar month", () => {
    const cycle = paydayCycle({ "2026-01": salary(2200, 1) });
    expect(periodRange("2026-11", cycle)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("clamps paydays on the 29th to 31st to the last day of short months", () => {
    const cycle = paydayCycle({ "2026-01": salary(2200, 31) });

    // El ciclo de marzo empieza el último día de febrero.
    expect(periodRange("2026-03", cycle)).toEqual({ start: "2026-02-28", end: "2026-03-30" });
    expect(periodRange("2026-05", cycle)).toEqual({ start: "2026-04-30", end: "2026-05-30" });
    expect(periodStart("2028-03", cycle)).toBe("2028-02-29");
    expect(periodIdOf("2026-02-27", cycle)).toBe("2026-02");
    expect(periodIdOf("2026-02-28", cycle)).toBe("2026-03");
  });

  it("crosses the year boundary", () => {
    const cycle = paydayCycle({ "2026-01": salary(2200, 25) });

    expect(periodRange("2027-01", cycle)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
    expect(periodIdOf("2026-12-24", cycle)).toBe("2026-12");
    expect(periodIdOf("2026-12-25", cycle)).toBe("2027-01");
    expect(periodIdOf("2026-12-31", cycle)).toBe("2027-01");
  });

  it("chains cycles without gaps when the payday changes or starts mid-year", () => {
    const cycle = paydayCycle({
      "2026-06": salary(2000, 28),
      "2026-09": salary(2100, 5),
      "2026-12": salary(2200, 20),
    });

    // Mayo es natural (aún sin sueldo) y termina donde empieza junio.
    expect(periodRange("2026-05", cycle)).toEqual({ start: "2026-05-01", end: "2026-05-27" });
    expect(periodRange("2026-08", cycle)).toEqual({ start: "2026-07-28", end: "2026-09-04" });
    expect(periodRange("2026-11", cycle)).toEqual({ start: "2026-11-05", end: "2026-11-19" });

    for (let month = 1; month <= 12; month += 1) {
      const monthId = `2026-${String(month).padStart(2, "0")}`;
      const next = month === 12 ? "2027-01" : `2026-${String(month + 1).padStart(2, "0")}`;
      const range = periodRange(monthId, cycle);
      expect(range.start <= range.end).toBe(true);
      expect(periodStart(next, cycle)).toBe(nextDay(range.end));
    }
  });

  it("puts every day of the year in exactly the cycle whose range holds it", () => {
    const cycle = paydayCycle({
      "2026-01": salary(2200, 30),
      "2026-07": salary(2200, 10),
    });
    let date = "2026-01-01";
    while (date <= "2026-12-31") {
      const monthId = periodIdOf(date, cycle);
      const range = periodRange(monthId, cycle);
      expect(date >= range.start && date <= range.end).toBe(true);
      date = nextDay(date);
    }
  });

  it("does not take a payday from a salary of zero", () => {
    expect(configuredPayday({ monthlySalary: { "2026-10": salary(0, 28) } }, "2026-10")).toBeNull();
  });
});
