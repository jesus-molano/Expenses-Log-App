import { expect, test, type Page } from "@playwright/test";
import { demoStore } from "../../src/domain/seed";

const currentStorageKey = "expense-log-store-v1";

async function loadDemoStore(page: Page) {
  await page.addInitScript(
    ({ key, store }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
    },
    { key: currentStorageKey, store: demoStore },
  );
}

async function clearStore(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.clear();
    window.localStorage.removeItem(key);
  }, currentStorageKey);
}

async function swipeRow(page: Page, name: string, distance: number) {
  const row = page
    .locator('[data-expense-row="true"]')
    .filter({ hasText: name })
    .first();
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();

  const startX = Math.min(box!.x + box!.width - 12, 354);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - distance, y, { steps: 10 });
  await page.mouse.up();
}

test("starts empty for a new local user", async ({ page }) => {
  await clearStore(page);
  await page.goto("/");

  await expect(page.getByText("Por pagar")).toBeVisible();
  await expect(page.getByText("0,00 €").first()).toBeVisible();
  await expect(page.getByText("Sin cargos previstos hoy")).toBeVisible();

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByText("Ingresos").first()).toBeVisible();
  await expect(page.getByText("0,00 €").first()).toBeVisible();
  await expect(page.getByText("Ahorro").first()).toBeVisible();
});

test("creates and pays a parsed recurring expense", async ({ page }) => {
  await loadDemoStore(page);
  await page.route("**/api/ai/parse-expenses", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "local",
        reason: "missing_key",
        expenses: [
          {
            name: "Spotify el musica",
            description: "Spotify 10,99 mensual el dia 12 musica",
            amount: 10.99,
            categoryName: "General",
            startDate: "2026-06-12",
            dueDay: 12,
            recurrence: { frequency: "monthly" },
          },
        ],
      }),
    });
  });
  await page.goto("/");

  await expect(page.getByText("Por pagar")).toBeVisible();
  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page
    .getByPlaceholder("Ej: Luz 64,75 mensual día 8")
    .fill("Spotify 10,99 mensual el dia 12 musica");
  await page.getByRole("button", { name: "Analizar texto" }).click({ force: true });

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(
    page
      .locator('[data-expense-row="true"]')
      .filter({ hasText: "Spotify el musica" })
      .first(),
  ).toBeVisible();
  await swipeRow(page, "Spotify el musica", 240);
  await expect(page.getByText("pagado").first()).toBeVisible();
});

test("requires a full left swipe before paying an expense", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/");

  await expect(page.getByText("Atrasado")).toBeVisible();
  await swipeRow(page, "Movistar", 72);
  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Movistar" }).first(),
  ).toContainText("hace");

  await swipeRow(page, "Movistar", 240);
  await expect(page.getByText("Pagado").first()).toBeVisible();
});

test("opens plan and configuration sheet", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(page.getByText("Plan del mes")).toBeVisible();
  await expect(page.getByText("Ingreso puntual")).toBeVisible();

  await page.getByRole("button", { name: "Configurar" }).click();
  await expect(page.getByRole("heading", { name: "Configurar Plan" })).toBeVisible();

  await page.getByLabel("Sueldo").fill("3000");
  await page.getByRole("button", { name: /Cambiar día de cobro/ }).click();
  await page.getByRole("button", { name: "25" }).click();
  await page.getByLabel("Ahorro este mes").fill("450");
  const accountNames = page.getByLabel("Nombre de cuenta");
  await accountNames.nth(0).fill("Cuenta principal test");
  await accountNames.nth(1).fill("Cuenta gastos test");
  await accountNames.nth(2).fill("Cuenta ahorro test");
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  await expect(page.getByText("Cuenta gastos test")).toBeVisible();
  await expect(page.getByText("Cuenta ahorro test")).toBeVisible();
  await expect(page.getByText("Cuenta principal test")).toBeVisible();
  await expect(page.getByText("450,00 €").first()).toBeVisible();
});

test("deletes an expense from the edit screen", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/expenses/exp-game-pass");

  await expect(page.getByRole("heading", { name: "Game Pass" })).toBeVisible();
  await page.getByRole("button", { name: "Borrar" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Borrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Game Pass" }),
  ).toHaveCount(0);
});

test("mobile shell routes render without runtime errors", async ({ page }) => {
  await loadDemoStore(page);

  for (const route of ["/", "/money", "/settings", "/expenses/new"]) {
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  }
});
