import { describe, expect, it } from "vitest";
import { clampViewMonth, formatMonthName } from "./month-view";

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
});
