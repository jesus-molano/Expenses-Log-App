import { expect, test, type Page } from "@playwright/test";
import { demoStore } from "../../src/domain/seed";

const currentStorageKey = "expense-log-store-v1";

async function loadDemoStore(page: Page) {
  await page.addInitScript(
    ({ key, store }) => {
      // Solo en la primera carga: lo que se borra o guarda en la prueba debe
      // seguir ahí al volver a una página anterior.
      if (window.sessionStorage.getItem("e2e-store-seeded")) return;
      window.sessionStorage.setItem("e2e-store-seeded", "1");
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
    },
    { key: currentStorageKey, store: demoStore },
  );
}

// El detalle se abre desde la lista: Atrás vuelve a ella.
async function openGamePassFromList(page: Page) {
  await loadDemoStore(page);
  await page.goto("/");
  await expect(page.getByText("Por pagar")).toBeVisible();
  await page.goto("/expenses/exp-game-pass");
  await expect(page.getByRole("heading", { name: "Game Pass" })).toBeVisible();
}

function expenseRows(page: Page, name: string) {
  return page.locator('[data-expense-row="true"]').filter({ hasText: name });
}

test("deletes an expense through the confirm dialog", async ({ page }) => {
  await openGamePassFromList(page);

  const deleteButton = page.getByRole("button", { name: "Borrar" });
  const dialog = page.getByRole("alertdialog", { name: "¿Borrar «Game Pass»?" });

  await deleteButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("No se puede deshacer");
  // El foco empieza en Cancelar y Escape cancela devolviendo el foco.
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(deleteButton).toBeFocused();

  // Atrás cancela sin salir del detalle.
  await deleteButton.click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/expenses\/exp-game-pass$/);
  await expect(page.getByRole("heading", { name: "Game Pass" })).toBeVisible();

  await deleteButton.click();
  await dialog.getByRole("button", { name: "Borrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Por pagar")).toBeVisible();
  await expect(expenseRows(page, "Game Pass")).toHaveCount(0);

  // Atrás desde la lista no reabre el detalle del gasto borrado.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/expenses\//);
});

test("asks before leaving the detail with unsaved changes", async ({ page }) => {
  await openGamePassFromList(page);

  const name = page.getByRole("textbox", { name: "Nombre" });
  const dialog = page.getByRole("alertdialog", {
    name: "¿Descartar los cambios en «Game Pass»?",
  });
  await name.fill("Game Pass Ultimate");

  // Atrás pregunta en lugar de salir; seguir editando conserva lo escrito.
  await page.goBack();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/expenses\/exp-game-pass$/);
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue("Game Pass Ultimate");

  // La guarda vuelve a estar puesta, y Atrás sobre el diálogo también cancela.
  await page.goBack();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue("Game Pass Ultimate");

  // El control de volver también pregunta; descartar sale sin guardar.
  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Por pagar")).toBeVisible();
  await expect(expenseRows(page, "Game Pass Ultimate")).toHaveCount(0);
  await expect(expenseRows(page, "Game Pass").first()).toBeAttached();
});

test("discarding after Back goes back to the list", async ({ page }) => {
  await openGamePassFromList(page);

  await page.getByRole("textbox", { name: "Nombre" }).fill("Game Pass Ultimate");
  await page.goBack();
  const dialog = page.getByRole("alertdialog", {
    name: "¿Descartar los cambios en «Game Pass»?",
  });
  await dialog.getByRole("button", { name: "Descartar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(expenseRows(page, "Game Pass Ultimate")).toHaveCount(0);
});

test("saving or leaving without changes does not ask", async ({ page }) => {
  await openGamePassFromList(page);

  // Sin cambios, Atrás sale directamente.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Game Pass" })).toBeVisible();

  // Escribir y deshacer lo escrito no deja cambios pendientes.
  const name = page.getByRole("textbox", { name: "Nombre" });
  await name.fill("Game Pass Ultimate");
  await name.fill("Game Pass");
  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();

  // Guardar sale a la lista sin preguntar, y Atrás no reabre el editor.
  await name.fill("Game Pass Ultimate");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(expenseRows(page, "Game Pass Ultimate").first()).toBeAttached();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/expenses\//);
});

test("a confirmation over a sheet closes on its own", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/money");

  await page.getByRole("button", { name: /Añadir ingreso extra/ }).click();
  const sheet = page.getByRole("dialog", { name: "Añadir ingreso extra" });
  await expect(sheet).toBeVisible();
  await sheet.getByPlaceholder("Bizum, renta...").fill("Bizum cena");
  await sheet.getByPlaceholder("40,00").fill("25");
  await sheet.getByRole("button", { name: "Añadir ingreso" }).click();
  await expect(sheet.getByText("Bizum cena")).toBeVisible();

  const removeButton = sheet.getByRole("button", { name: "Quitar ingreso" });
  const dialog = page.getByRole("alertdialog", { name: "¿Quitar «Bizum cena»?" });

  // Escape y Atrás cierran solo la confirmación, no la hoja de debajo.
  await removeButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(removeButton).toBeFocused();

  await removeButton.click();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(sheet).toBeVisible();

  await removeButton.click();
  await dialog.getByRole("button", { name: "Quitar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Bizum cena")).toHaveCount(0);

  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/money$/);
});
