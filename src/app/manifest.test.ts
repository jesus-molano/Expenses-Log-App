import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_COLORS } from "@/shared/theme";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("offers the add, voice and plan shortcuts", () => {
    expect(manifest().shortcuts?.map((shortcut) => [shortcut.name, shortcut.url])).toEqual([
      ["Añadir gasto", "/expenses/new"],
      ["Añadir por voz", "/expenses/new?mode=voice"],
      ["Plan", "/money"],
    ]);
  });

  it("ships maskable icons with their own safe margin", () => {
    const icons = manifest().icons ?? [];
    const maskable = icons.filter((icon) => icon.purpose === "maskable");

    expect(maskable.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
    // El maskable ya no reutiliza el icono "any", que se recortaría.
    expect(maskable.every((icon) => icon.src.startsWith("/icon-maskable-"))).toBe(true);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src.split("?")[0]))).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "public", "badge-96.png"))).toBe(true);
  });

  it("uses the default theme background for the splash screen", () => {
    expect(manifest()).toMatchObject({
      theme_color: THEME_COLORS[DEFAULT_THEME],
      background_color: THEME_COLORS[DEFAULT_THEME],
    });
  });
});
