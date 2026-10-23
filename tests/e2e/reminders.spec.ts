import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "../../src/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function template(
  id: string,
  name: string,
  dueDay: number,
  overrides: Partial<ExpenseTemplate> = {},
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount: 12.99,
    currency: "EUR",
    categoryId: "subs",
    startDate: `2026-10-${String(dueDay).padStart(2, "0")}`,
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

// Lunes 26 de octubre: Netflix vence el jueves 29 y el seguro anual, el 20
// de noviembre.
const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("exp-netflix", "Netflix", 29),
    template("exp-insurance", "Seguro hogar", 20, {
      amount: 180,
      startDate: "2026-11-20",
      recurrence: { frequency: "yearly", annualMonth: 11 },
    }),
  ],
};

async function seed(page: Page, seeded: ExpenseStore = store) {
  await page.clock.setFixedTime(new Date("2026-10-26T10:00:00"));
  await page.addInitScript(
    ({ key, value }) => {
      // Solo la primera vez: una recarga debe ver lo guardado por la app.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, value: seeded },
  );
}

function row(page: Page, occurrenceId: string) {
  return page.locator(`[data-expense-row-id="${occurrenceId}"]`);
}

test("opens the charge a notification points to", async ({ page }) => {
  await seed(page);
  await page.goto("/?occurrence=exp-netflix%3A2026-10-29");

  const netflix = row(page, "exp-netflix:2026-10-29");
  await expect(netflix).toHaveAttribute("data-highlighted", "true");
  await expect(netflix).toBeFocused();
  await expect(netflix).toBeInViewport();
  // El parámetro se quita: recargar no repite el salto.
  await expect(page).toHaveURL(/\/$/);
});

test("moves to the month of a charge outside the current one", async ({ page }) => {
  await seed(page);
  await page.goto("/?occurrence=exp-insurance%3A2026-11-20");

  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(row(page, "exp-insurance:2026-11-20")).toHaveAttribute(
    "data-highlighted",
    "true",
  );
});

test("explains when the linked charge no longer exists", async ({ page }) => {
  await seed(page);
  await page.goto("/?occurrence=exp-deleted%3A2026-10-20");

  await expect(
    page.getByRole("status").filter({ hasText: "Ese recibo ya no está en la lista." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("turns an expense's reminder on and off from its bell", async ({ page }) => {
  await seed(page);
  await page.goto("/");

  const bell = page.getByRole("button", { name: "Aviso antes del cobro: Netflix" });
  await expect(bell).toHaveAttribute("aria-pressed", "false");

  await bell.click();
  await expect(bell).toHaveAttribute("aria-pressed", "true");
  const toast = page.getByRole("status").filter({ hasText: "Te avisaré de Netflix 3 días antes." });
  await expect(toast).toBeVisible();
  // Sin permiso de notificaciones se explica cómo recibirlos.
  await expect(toast).toContainText("Activa los avisos push en Ajustes");

  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(bell).toHaveAttribute("aria-pressed", "false");

  await bell.click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aviso antes del cobro: Netflix" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("sets the default reminder, the long-cycle notice and the hour in Settings", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/settings");

  await expect(page.getByText("Solo los recibos con campana · desde las 08:00")).toBeVisible();
  await page.getByRole("button", { name: "Configurar", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "Recordatorios" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("switch", { name: "Avisar de todos los recibos" }).click();
  await sheet
    .getByRole("group", { name: "Antelación de trimestrales y anuales" })
    .getByRole("button", { name: "30 días" })
    .click();
  await sheet.getByRole("button", { name: "08:00" }).click();
  await sheet.getByRole("option", { name: "21:00" }).click();
  await sheet.getByRole("switch", { name: "Mes al día" }).click();
  await expect(sheet.getByRole("switch", { name: "Mes al día" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  await expect(page.getByText("Todos los recibos · 3 días antes · desde las 21:00")).toBeVisible();

  // Los recibos sin ajuste propio siguen ahora el aviso por defecto.
  await page.getByRole("link", { name: "Gastos" }).first().click();
  await expect(
    page.getByRole("button", { name: "Aviso antes del cobro: Netflix" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test.describe("on an iPhone without the app installed", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  });

  test("explains how to install it to get notifications", async ({ page }) => {
    await seed(page);
    await page.goto("/settings");

    await expect(page.getByText("Instalar en el iPhone")).toBeVisible();
    await page.getByRole("button", { name: "Cómo", exact: true }).click();

    const sheet = page.getByRole("dialog", { name: "Instalar en el iPhone" });
    await expect(sheet.getByText("Elige «Añadir a pantalla de inicio» y confirma con «Añadir».")).toBeVisible();
    await sheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(sheet).toHaveCount(0);
  });
});

test("paints the system bar with the chosen theme", async ({ page }) => {
  await seed(page);
  await page.goto("/settings");

  const themeColor = page.locator('meta[name="theme-color"]').first();
  await expect(themeColor).toHaveAttribute("content", "#070810");

  await page.getByRole("button", { name: /Vice Afterglow/ }).click();
  await page.getByRole("option", { name: /Nord Night/ }).click();
  await expect(themeColor).toHaveAttribute("content", "#2e3440");

  await page.reload();
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    "content",
    "#2e3440",
  );
});

test("lists the Plan shortcut and maskable icons in the manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  const manifest = await response.json();

  expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
    "/expenses/new",
    "/expenses/new?mode=voice",
    "/money",
  ]);
  expect(
    manifest.icons.filter((icon: { purpose?: string }) => icon.purpose === "maskable"),
  ).toHaveLength(2);
});
