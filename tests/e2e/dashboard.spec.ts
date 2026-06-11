import { expect, test } from "@playwright/test";

async function swipeLeftFromRow(page: import("@playwright/test").Page, name: string) {
  const row = page.locator('[data-expense-row="true"]').filter({ hasText: name }).first();
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();

  const y = box!.y + box!.height / 2;
  await page.mouse.move(Math.min(box!.x + 260, 354), y);
  await page.mouse.down();
  await page.mouse.move(Math.min(box!.x + 150, 280), y, { steps: 6 });
  await page.mouse.move(Math.max(box!.x + 20, 48), y, { steps: 6 });
  await page.mouse.up();
}

test("creates and pays a parsed recurring expense", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Por pagar")).toBeVisible();
  await page
    .getByPlaceholder("Netflix 15,99 mensual día 12")
    .fill("Spotify 10,99 mensual el dia 12 musica");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Spotify el musica" }).first(),
  ).toBeVisible();
  await swipeLeftFromRow(page, "Spotify el musica");
  await expect(page.getByText("pagado").first()).toBeVisible();
});

test("marks an overdue expense as paid with a left swipe", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Atrasado")).toBeVisible();
  await swipeLeftFromRow(page, "Movistar");

  await expect(page.getByText("Pagado").first()).toBeVisible();
});

test("opens money plan and configuration sheet", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Dinero" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(page.getByText("Reparto del mes")).toBeVisible();
  await expect(page.getByText("Ingreso puntual")).toBeVisible();

  await page.getByRole("button", { name: "Configurar" }).click();
  await expect(page.getByRole("heading", { name: "Configurar dinero" })).toBeVisible();

  await page.getByLabel("Sueldo").fill("3000");
  await page.getByRole("button", { name: /Cambiar dia de cobro/ }).click();
  await page.getByRole("button", { name: "25" }).click();
  await page.getByLabel("Ahorro mensual").fill("450");
  await page.getByLabel("Cuenta gastos").fill("Cuenta gastos test");
  await page.getByLabel("Cuenta ahorro").fill("Cuenta ahorro test");
  await page.getByLabel("Cuenta principal").fill("Cuenta principal test");
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  await expect(page.getByText("Cuenta gastos test")).toBeVisible();
  await expect(page.getByText("Cuenta ahorro test")).toBeVisible();
  await expect(page.getByText("Cuenta principal test")).toBeVisible();
  await expect(page.getByText("Objetivo: 450,00 €")).toBeVisible();
});
