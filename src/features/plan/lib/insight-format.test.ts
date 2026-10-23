import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/domain/calendar";
import { formatDaysUntil, formatPercent, formatSignedCurrency } from "./insight-format";

describe("insight format", () => {
  it("formats shares as whole percentages", () => {
    expect(formatPercent(0.39387, "en")).toBe("39%");
    expect(formatPercent(0.39387, "es")).toMatch(/^39\s?%$/);
  });

  it("says when a bill is coming", () => {
    expect(formatDaysUntil(0, "es")).toBe("hoy");
    expect(formatDaysUntil(1, "en")).toBe("tomorrow");
    expect(formatDaysUntil(35, "es")).toBe("en 35 días");
  });

  it("always shows the sign of a change", () => {
    expect(formatSignedCurrency(12.5, formatCurrency)).toMatch(/^\+12,50\s€$/);
    expect(formatSignedCurrency(-8, formatCurrency)).toMatch(/^−8,00\s€$/);
    expect(formatSignedCurrency(0, formatCurrency)).toMatch(/^±0,00\s€$/);
  });
});
