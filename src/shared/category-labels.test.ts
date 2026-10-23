import { describe, expect, it } from "vitest";
import { resolvePresetCategory } from "@/domain/categories";
import { categoryLabel, resolveCategoryName } from "./category-labels";

describe("category labels", () => {
  it("shows stored names with accents without changing what is stored", () => {
    expect(categoryLabel("Alimentacion", "es")).toBe("Alimentación");
    expect(categoryLabel("Vehiculo", "es")).toBe("Vehículo");
    expect(categoryLabel("Educacion/Trabajo", "es")).toBe("Educación/Trabajo");
    expect(categoryLabel("Educacion/Trabajo", "en")).toBe("Education/Work");
  });

  it("recognises stored names written with accents or other casing", () => {
    expect(categoryLabel("alimentación", "es")).toBe("Alimentación");
    expect(categoryLabel("EDUCACIÓN/TRABAJO", "es")).toBe("Educación/Trabajo");
    expect(categoryLabel("Mi categoría", "es")).toBe("Mi categoría");
  });

  it("maps visible labels in either language back to the stored name", () => {
    expect(resolveCategoryName("Educación/Trabajo")).toBe("Educacion/Trabajo");
    expect(resolveCategoryName("Education/Work")).toBe("Educacion/Trabajo");
    expect(resolveCategoryName("Utilities")).toBe("Servicios");
    expect(resolveCategoryName("Vehículo")).toBe("Vehiculo");
    expect(resolveCategoryName("gimnasio")).toBe("Deporte");
    expect(resolveCategoryName("  ")).toBe("General");
  });

  it("resolves custom categories the same way, before presets and aliases", () => {
    const own = ["Caprichos", "Food"];
    expect(resolveCategoryName("caprichos", own)).toBe("Caprichos");
    expect(resolveCategoryName("CAPRÍCHOS", own)).toBe("Caprichos");
    // Una propia que coincide con la etiqueta de una preset gana a la preset.
    expect(resolveCategoryName("Food", own)).toBe("Food");
    expect(resolveCategoryName("Food")).toBe("Alimentacion");
    // Lo que no es ninguna conocida vuelve como categoría propia.
    expect(resolveCategoryName(" Sin nombre conocido ")).toBe("Sin nombre conocido");
    expect(categoryLabel("Caprichos", "en")).toBe("Caprichos");
  });

  it("does not send accented preset names to General", () => {
    expect(resolvePresetCategory("Alimentación").name).toBe("Alimentacion");
    expect(resolvePresetCategory(" vehículo ").name).toBe("Vehiculo");
    expect(resolvePresetCategory("Otra").name).toBe("General");
  });
});
