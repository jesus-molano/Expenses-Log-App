import { expect, test } from "@playwright/test";

async function swipeLeftFromLink(page: import("@playwright/test").Page, name: string) {
  const link = page.getByRole("link", { name }).first();
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
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
    .getByPlaceholder("Netflix 15,99 mensual dia 12")
    .fill("Spotify 10,99 mensual el dia 12 musica");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(page.getByRole("link", { name: "Spotify el musica" }).first()).toBeVisible();
  await swipeLeftFromLink(page, "Spotify el musica");
  await expect(page.getByText("pagado").first()).toBeVisible();
});

test("marks an overdue expense as paid with a left swipe", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Atrasado")).toBeVisible();
  await swipeLeftFromLink(page, "Movistar");

  await expect(page.getByText("Pagado").first()).toBeVisible();
});
