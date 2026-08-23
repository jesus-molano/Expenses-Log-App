import { describe, expect, it } from "vitest";
import {
  APP_THEMES,
  DEFAULT_THEME,
  isAppTheme,
  normalizeAppTheme,
} from "./theme";

describe("theme", () => {
  it("accepts every supported app theme", () => {
    expect(APP_THEMES).toHaveLength(8);
    APP_THEMES.forEach((theme) => expect(isAppTheme(theme)).toBe(true));
  });

  it("migrates legacy themes to Vice Afterglow", () => {
    expect(normalizeAppTheme("dark")).toBe(DEFAULT_THEME);
    expect(normalizeAppTheme("light")).toBe(DEFAULT_THEME);
    expect(normalizeAppTheme("rose-pine")).toBe("rose-pine");
    expect(normalizeAppTheme("catppuccin")).toBe("catppuccin");
  });

  it("rejects unknown themes", () => {
    expect(isAppTheme("mocha-lime")).toBe(false);
    expect(isAppTheme("legacy")).toBe(false);
    expect(isAppTheme(null)).toBe(false);
  });
});
