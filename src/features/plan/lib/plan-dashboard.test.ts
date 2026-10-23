import { describe, expect, it } from "vitest";
import { formatShortDate } from "./plan-dashboard";

describe("formatShortDate", () => {
  it("shows day and short month in the app language", () => {
    expect(formatShortDate("2026-10-15", "es")).toBe("15 oct");
    expect(formatShortDate("2026-10-15", "en")).toBe("Oct 15");
  });

  it("keeps a malformed date as written instead of throwing", () => {
    expect(formatShortDate("15/10/2026", "es")).toBe("15/10/2026");
  });
});
