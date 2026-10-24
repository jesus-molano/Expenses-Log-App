import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  APP_THEMES,
  DEFAULT_THEME,
  THEME_COLORS,
  isAppTheme,
  normalizeAppTheme,
  setThemeDom,
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

describe("theme color", () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  });

  it("matches the background token of every theme", () => {
    const tokens = readFileSync(join(process.cwd(), "src/app/styles/tokens.css"), "utf8");

    APP_THEMES.forEach((theme) => {
      const block = tokens.match(
        new RegExp(`:root\\[data-theme="${theme}"\\] \\{([^}]*)\\}`),
      )?.[1];
      const background = block?.match(/--noctalia-background:\s*(#[0-9a-f]{6})/i)?.[1];
      expect(background, theme).toBe(THEME_COLORS[theme]);
    });
  });

  it("paints the system bar with the chosen theme", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLORS[DEFAULT_THEME];
    document.head.appendChild(meta);

    setThemeDom("nord");

    expect(document.documentElement.dataset.theme).toBe("nord");
    expect(meta.content).toBe(THEME_COLORS.nord);
  });
});
