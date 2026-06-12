import { describe, expect, it } from "vitest";
import { isAppTheme } from "./theme";

describe("theme", () => {
  it("accepts every supported app theme", () => {
    expect(isAppTheme("dark")).toBe(true);
    expect(isAppTheme("rose-pine")).toBe(true);
    expect(isAppTheme("catppuccin")).toBe(true);
    expect(isAppTheme("light")).toBe(true);
  });

  it("rejects unknown themes", () => {
    expect(isAppTheme("mocha-lime")).toBe(false);
    expect(isAppTheme("legacy")).toBe(false);
    expect(isAppTheme(null)).toBe(false);
  });
});
