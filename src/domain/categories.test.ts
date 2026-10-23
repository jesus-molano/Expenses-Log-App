import { describe, expect, it } from "vitest";
import {
  buildCategoryOptions,
  categoryUsage,
  newCategoryFields,
  resolvePresetCategory,
  validateCategoryName,
} from "./categories";
import { emptyStore } from "./seed";
import type { ExpenseCategory } from "./types";

const category = (
  id: string,
  name: string,
  tone: ExpenseCategory["tone"] = "slate",
): ExpenseCategory => ({ id, userId: "demo", name, icon: "Tag", tone });

describe("categories", () => {
  it("resolves presets without accents or case and falls back to General", () => {
    expect(resolvePresetCategory("alimentación").name).toBe("Alimentacion");
    expect(resolvePresetCategory(" OCIO ").name).toBe("Ocio");
    expect(resolvePresetCategory("Viajes").name).toBe("General");
  });

  it("gives a new category the preset look or a custom one", () => {
    expect(newCategoryFields("alimentación")).toEqual({
      name: "Alimentacion",
      icon: "Utensils",
      tone: "orange",
    });
    expect(newCategoryFields("Ocio", "blue")).toEqual({ name: "Ocio", icon: "Gamepad2", tone: "blue" });
    expect(newCategoryFields(" Caprichos ")).toEqual({ name: "Caprichos", icon: "Tag", tone: "slate" });
    expect(newCategoryFields("x".repeat(40), "rose").name).toHaveLength(30);
  });

  it("validates names against the user's own categories", () => {
    const categories = [category("a", "Viajes"), category("b", "Casa")];

    expect(validateCategoryName(categories, "  ")).toBe("empty");
    expect(validateCategoryName(categories, "x".repeat(31))).toBe("tooLong");
    expect(validateCategoryName(categories, "viájes")).toBe("duplicate");
    // Renombrar una categoría con su propio nombre no es un duplicado.
    expect(validateCategoryName(categories, "Viajes", "a")).toBeNull();
    expect(validateCategoryName(categories, "Regalos")).toBeNull();
  });

  it("lists presets with the user's colour and then custom ones alphabetically", () => {
    const options = buildCategoryOptions([
      category("c1", "Regalos", "rose"),
      category("c2", "Casa", "violet"),
      category("c3", "Bebé", "blue"),
    ]);

    expect(options[0]).toEqual({
      name: "Casa",
      icon: "Home",
      tone: "violet",
      id: "c2",
      custom: false,
    });
    expect(options.find((option) => option.name === "Ocio")).toMatchObject({
      tone: "violet",
      id: undefined,
      custom: false,
    });
    expect(options.slice(-2)).toEqual([
      { name: "Bebé", icon: "Tag", tone: "blue", id: "c3", custom: true },
      { name: "Regalos", icon: "Tag", tone: "rose", id: "c1", custom: true },
    ]);
  });

  it("counts the series and edited charges that use a category", () => {
    const store = {
      ...emptyStore,
      templates: [
        { categoryId: "x" },
        { categoryId: "x" },
        { categoryId: "y" },
      ] as typeof emptyStore.templates,
      overrides: [{ categoryId: "x" }, {}] as typeof emptyStore.overrides,
    };

    expect(categoryUsage(store, "x")).toEqual({ templates: 2, occurrences: 1 });
    expect(categoryUsage(store, "z")).toEqual({ templates: 0, occurrences: 0 });
  });
});
