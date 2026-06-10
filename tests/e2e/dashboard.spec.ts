import { expect, test } from "@playwright/test";

test("creates and pays a parsed recurring expense", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
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
