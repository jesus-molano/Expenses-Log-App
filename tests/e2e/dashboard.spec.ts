import { expect, test } from "@playwright/test";

test("creates and pays a parsed recurring expense", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Por pagar")).toBeVisible();
  await page
    .getByPlaceholder("Netflix 15,99 mensual dia 12")
    .fill("Spotify 10,99 mensual el dia 12 musica");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(page.getByRole("link", { name: "Spotify el musica" }).first()).toBeVisible();
  await page.getByLabel("Marcar como pagado").first().click();
  await expect(page.getByText("pagado").first()).toBeVisible();
});

test("marks an overdue expense as paid with a left swipe", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Atrasado")).toBeVisible();
  const overdueLink = page.getByRole("link", { name: "Luz" }).first();
  const box = await overdueLink.boundingBox();
  expect(box).not.toBeNull();

  const y = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + 260, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + 150, y, { steps: 6 });
  await page.mouse.move(box!.x + 60, y, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText("Pagado").first()).toBeVisible();
});
