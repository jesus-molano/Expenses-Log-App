import { addDays, format, parseISO } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysBetween, estimateChargeDate } from "./calendar";
import {
  MAX_CHARGE_DELAY_DAYS,
  bankHolidayOn,
  easterSunday,
  isBankBusinessDay,
  nextBankBusinessDay,
  spanishBankHolidays,
} from "./holidays";

describe("easterSunday", () => {
  it("matches the published Easter dates", () => {
    const known: Record<number, string> = {
      2000: "2000-04-23",
      2008: "2008-03-23",
      2011: "2011-04-24",
      2019: "2019-04-21",
      2024: "2024-03-31",
      2025: "2025-04-20",
      2026: "2026-04-05",
      2027: "2027-03-28",
      2028: "2028-04-16",
      2029: "2029-04-01",
      2030: "2030-04-21",
      2038: "2038-04-25",
      2285: "2285-03-22",
    };

    for (const [year, date] of Object.entries(known)) {
      expect(easterSunday(Number(year))).toBe(date);
    }
  });
});

describe("spanishBankHolidays", () => {
  it("lists the national, Easter and TARGET2 closing days of 2026", () => {
    expect(spanishBankHolidays(2026).map(({ date, key }) => [date, key])).toEqual([
      ["2026-01-01", "newYear"],
      ["2026-01-06", "epiphany"],
      ["2026-04-02", "holyThursday"],
      ["2026-04-03", "goodFriday"],
      ["2026-04-06", "easterMonday"],
      ["2026-05-01", "labourDay"],
      ["2026-08-15", "assumption"],
      ["2026-10-12", "nationalDay"],
      ["2026-11-01", "allSaints"],
      ["2026-12-06", "constitution"],
      ["2026-12-08", "immaculateConception"],
      ["2026-12-25", "christmas"],
      ["2026-12-26", "boxingDay"],
    ]);
  });

  it("moves the Easter holidays with Easter", () => {
    expect(bankHolidayOn("2027-03-25")?.key).toBe("holyThursday");
    expect(bankHolidayOn("2027-03-26")?.key).toBe("goodFriday");
    expect(bankHolidayOn("2027-03-29")?.key).toBe("easterMonday");
    expect(bankHolidayOn("2026-03-26")).toBeNull();
  });

  it("does not treat ordinary days or unreadable dates as holidays", () => {
    expect(bankHolidayOn("2026-10-13")).toBeNull();
    expect(bankHolidayOn("nope")).toBeNull();
    expect(isBankBusinessDay("2026-10-13")).toBe(true);
  });
});

describe("nextBankBusinessDay", () => {
  it("skips weekends and holidays", () => {
    // Lunes festivo.
    expect(nextBankBusinessDay("2026-10-12")).toBe("2026-10-13");
    // Viernes de Navidad, fin de semana (el 26 cae en sábado) y lunes hábil.
    expect(nextBankBusinessDay("2026-12-25")).toBe("2026-12-28");
    // Año nuevo en viernes.
    expect(nextBankBusinessDay("2027-01-01")).toBe("2027-01-04");
    // Martes de la Inmaculada.
    expect(nextBankBusinessDay("2026-12-08")).toBe("2026-12-09");
  });

  it("crosses the whole Easter block", () => {
    // Jueves Santo, Viernes Santo, sábado, domingo y Lunes de Pascua.
    expect(nextBankBusinessDay("2026-04-02")).toBe("2026-04-07");
    expect(nextBankBusinessDay("2026-04-04")).toBe("2026-04-07");
  });

  it("keeps business days and returns unreadable input unchanged", () => {
    expect(nextBankBusinessDay("2026-10-23")).toBe("2026-10-23");
    expect(nextBankBusinessDay("2026-12-24")).toBe("2026-12-24");
    expect(nextBankBusinessDay("nope")).toBe("nope");
  });

  it("handles 26 December on a weekday", () => {
    expect(nextBankBusinessDay("2028-12-25")).toBe("2028-12-27");
  });

  it("never delays a charge more than MAX_CHARGE_DELAY_DAYS", () => {
    let longest = 0;
    for (
      let date = parseISO("2026-01-01");
      date < parseISO("2041-01-01");
      date = addDays(date, 1)
    ) {
      const day = format(date, "yyyy-MM-dd");
      longest = Math.max(longest, daysBetween(day, nextBankBusinessDay(day)));
    }
    expect(longest).toBe(MAX_CHARGE_DELAY_DAYS);
  });
});

describe("estimateChargeDate with holidays", () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Atlantic/Canary";
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it("moves a bill due on a holiday to the next business day", () => {
    expect(estimateChargeDate("2026-10-12")).toEqual({
      date: "2026-10-13",
      label: "estimado martes 13",
    });
    expect(estimateChargeDate("2026-12-08", "en")).toEqual({
      date: "2026-12-09",
      label: "estimated Wednesday 9",
    });
  });

  it("still moves weekends and keeps business days", () => {
    expect(estimateChargeDate("2026-10-31").date).toBe("2026-11-02");
    expect(estimateChargeDate("2026-11-01").date).toBe("2026-11-02");
    expect(estimateChargeDate("2026-10-23")).toEqual({
      date: "2026-10-23",
      label: "cobro viernes 23",
    });
  });
});
