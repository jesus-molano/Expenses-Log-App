import { describe, expect, it } from "vitest";
import { formatMessage, messages, t } from "./i18n";

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
    expect(t("categories.vehiculo", "es")).toBe("Vehículo");
    expect(t("categories.vehiculo", "en")).toBe("Vehicle");
  });

  it("fills placeholders and keeps the unknown ones visible", () => {
    expect(formatMessage("plan.planFor", { month: "octubre" }, "es")).toBe(
      "Plan de octubre",
    );
    expect(
      formatMessage("plan.paidReceiptsProgress", { paid: 3, total: 5 }, "en"),
    ).toBe("3 of 5 receipts paid");
    expect(formatMessage("plan.planFor", {}, "es")).toBe("Plan de {month}");
  });
});
