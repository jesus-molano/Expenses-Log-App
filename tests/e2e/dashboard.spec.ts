import { expect, test } from "@playwright/test";

test("creates and pays a parsed recurring expense", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gastos" })).toBeVisible();
  await page
    .getByPlaceholder("Ej. Netflix 15,99 mensual el dia 12 entretenimiento")
    .fill("Spotify 10,99 mensual el dia 12 musica");
  await page.getByRole("button", { name: "Analizar" }).click();

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await page.getByRole("button", { name: "Todos" }).first().click();
  await expect(page.getByText("Spotify")).toBeVisible();
  await page.getByLabel("Marcar como pagado").first().click();
  await expect(page.getByText("pagado").first()).toBeVisible();
});
