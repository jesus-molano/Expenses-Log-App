import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysBetween } from "./calendar";

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
