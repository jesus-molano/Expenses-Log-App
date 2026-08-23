import { describe, expect, it } from "vitest";
import { getTooltipSeriesColor } from "./MonthlyTrendChart";

describe("getTooltipSeriesColor", () => {
  it.each([
    ["expenses", "var(--app-chart-expenses)"],
    ["savings", "var(--app-chart-savings)"],
    ["capacity", "var(--app-chart-capacity)"],
  ])("uses the semantic color for the %s series", (dataKey, expected) => {
    expect(
      getTooltipSeriesColor({
        dataKey,
        color: "url(#chartGradient)",
      }),
    ).toBe(expected);
  });

  it("does not pass an SVG gradient reference to an HTML marker", () => {
    expect(
      getTooltipSeriesColor({ color: "url(#unknownGradient)" }),
    ).toBe("var(--app-text-muted)");
  });
});
