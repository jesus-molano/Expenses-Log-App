import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import { DashboardShell } from "./DashboardShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/forecast",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

describe("DashboardShell", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it.each([
    ["es", ["Gastos", "Mes", "Cuentas", "Previsión"]],
    ["en", ["Expenses", "Month", "Accounts", "Forecast"]],
  ] as const)("shows the four tabs in %s and marks the open one", (language, labels) => {
    render(
      <DashboardShell
        headlineLabel="110,00 €"
        headlineTitle="Aparta al mes"
        activeTab="forecast"
        language={language}
        panelChrome="visible"
      >
        <p>content</p>
      </DashboardShell>,
    );

    const nav = screen.getByRole("navigation", { name: t("common.sections", language) });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(labels);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/money",
      "/accounts",
      "/forecast",
    ]);
    expect(links[3]).toHaveAttribute("aria-current", "page");
    expect(links[0]).not.toHaveAttribute("aria-current");
  });

  it("remembers the tab and lets Ajustes come back to it", () => {
    render(
      <DashboardShell
        headlineLabel="0,00 €"
        headlineTitle="Te sobran · Sabadell"
        activeTab="accounts"
        language="es"
        panelChrome="visible"
      >
        <p>content</p>
      </DashboardShell>,
    );

    expect(window.sessionStorage.getItem("expense-last-tab")).toBe("accounts");
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/settings?from=accounts",
    );
  });
});
