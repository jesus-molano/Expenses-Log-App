import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  daysBetween,
  isValidDateOnly,
  isValidTimeZone,
  normalizeDateOnly,
  zonedDateParts,
} from "./calendar";

describe("daysBetween", () => {
  const originalTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Atlantic/Canary";
  });

  afterAll(() => {
    process.env.TZ = originalTimeZone;
  });

  it("counts calendar days across the October DST change", () => {
    expect(daysBetween("2026-10-23", "2026-10-30")).toBe(7);
    expect(daysBetween("2026-10-25", "2026-10-26")).toBe(1);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("counts calendar days across the March DST change", () => {
    expect(daysBetween("2027-03-27", "2027-03-30")).toBe(3);
    expect(daysBetween("2027-03-30", "2027-03-27")).toBe(-3);
  });

  it("returns zero for the same day", () => {
    expect(daysBetween("2026-10-25", "2026-10-25")).toBe(0);
  });
});

describe("normalizeDateOnly", () => {
  it("clamps days that do not exist in the month", () => {
    expect(normalizeDateOnly("2026-11-31")).toBe("2026-11-30");
    expect(normalizeDateOnly("2026-02-30")).toBe("2026-02-28");
    expect(normalizeDateOnly("2028-02-30")).toBe("2028-02-29");
  });

  it("rejects values that are not dates", () => {
    for (const value of ["2026-13-01", "2026-00-10", "2026-1-5", "abc", "", null, 20261101]) {
      expect(normalizeDateOnly(value)).toBeUndefined();
    }
  });

  it("reads the calendar day of ISO date-times as written", () => {
    expect(normalizeDateOnly("2026-11-15T00:00:00Z")).toBe("2026-11-15");
    expect(normalizeDateOnly("2026-11-15T23:30:00.000+05:00")).toBe("2026-11-15");
    expect(normalizeDateOnly("2026-11-15Tnope")).toBeUndefined();
    expect(isValidDateOnly("2026-11-15T00:00:00Z")).toBe(false);
  });

  it("only accepts real dates as valid", () => {
    expect(isValidDateOnly("2026-11-30")).toBe(true);
    expect(isValidDateOnly("2026-11-31")).toBe(false);
  });
});

describe("zonedDateParts", () => {
  it("reads the date and hour in the user's zone, not the server's", () => {
    // 23:30 UTC del sábado 24 de octubre (horario de verano en Canarias).
    const instant = new Date("2026-10-24T23:30:00.000Z");
    expect(zonedDateParts(instant, "Atlantic/Canary")).toEqual({ date: "2026-10-25", hour: 0 });
    expect(zonedDateParts(instant, "America/New_York")).toEqual({ date: "2026-10-24", hour: 19 });
    expect(zonedDateParts(instant, "UTC")).toEqual({ date: "2026-10-24", hour: 23 });
  });

  it("follows the DST change", () => {
    // El 25 de octubre Canarias vuelve a UTC+0.
    expect(zonedDateParts(new Date("2026-10-25T08:00:00.000Z"), "Atlantic/Canary").hour).toBe(8);
    expect(zonedDateParts(new Date("2026-10-24T08:00:00.000Z"), "Atlantic/Canary").hour).toBe(9);
  });

  it("falls back to the app zone with an invalid zone", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
    expect(zonedDateParts(new Date("2026-07-01T07:00:00.000Z"), "Mars/Olympus")).toEqual({
      date: "2026-07-01",
      hour: 8,
    });
  });
});
