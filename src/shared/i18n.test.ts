import { describe, expect, it } from "vitest";
import { messages, t } from "./i18n";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return typeof nested === "string" ? [nextPrefix] : flattenKeys(nested, nextPrefix);
  });
}

describe("i18n", () => {
  it("does not contain mojibake in shipped dictionaries", () => {
    const serialized = JSON.stringify(messages);

    expect(serialized).not.toMatch(/[\u00c2\u00c3]/);
  });

  it("keeps Spanish and English keys in sync", () => {
    expect(flattenKeys(messages.en).sort()).toEqual(flattenKeys(messages.es).sort());
  });

  it("translates shared keys and categories in Spanish and English", () => {
    expect(t("common.expenses", "es")).toBe("Gastos");
    expect(t("common.expenses", "en")).toBe("Expenses");
    expect(t("settings.delete", "es")).toBe("Borrar");
    expect(t("settings.delete", "en")).toBe("Delete");
    expect(t("categories.suscripciones", "es")).toBe("Suscripciones");
    expect(t("categories.suscripciones", "en")).toBe("Subscriptions");
    expect(t("categories.vehiculo", "es")).toBe("Vehiculo");
    expect(t("categories.vehiculo", "en")).toBe("Vehicle");
  });
});
