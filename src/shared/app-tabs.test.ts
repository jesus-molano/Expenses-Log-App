import { describe, expect, it } from "vitest";
import {
  APP_TABS,
  appTabHref,
  appTabLabelKey,
  isAppTab,
  parseAppTab,
  settingsHrefFrom,
} from "./app-tabs";
import { t } from "./i18n";

describe("app tabs", () => {
  it("keeps the four tabs in the bottom nav order with their routes", () => {
    expect(APP_TABS.map((tab) => [tab, appTabHref(tab)])).toEqual([
      ["expenses", "/"],
      ["money", "/money"],
      ["accounts", "/accounts"],
      ["forecast", "/forecast"],
    ]);
  });

  it("labels every tab in Spanish and English", () => {
    expect(APP_TABS.map((tab) => t(appTabLabelKey(tab), "es"))).toEqual([
      "Gastos",
      "Mes",
      "Cuentas",
      "Previsión",
    ]);
    expect(APP_TABS.map((tab) => t(appTabLabelKey(tab), "en"))).toEqual([
      "Expenses",
      "Month",
      "Accounts",
      "Forecast",
    ]);
  });

  it("accepts the new tabs from ?from= and falls back to Gastos", () => {
    expect(parseAppTab("money")).toBe("money");
    expect(parseAppTab("accounts")).toBe("accounts");
    expect(parseAppTab("forecast")).toBe("forecast");
    expect(parseAppTab("plan")).toBe("expenses");
    expect(parseAppTab("//evil.com")).toBe("expenses");
    expect(parseAppTab(null)).toBe("expenses");
    expect(isAppTab("toString")).toBe(false);
  });

  it("links to Ajustes remembering the tab", () => {
    expect(settingsHrefFrom("forecast")).toBe("/settings?from=forecast");
  });
});
