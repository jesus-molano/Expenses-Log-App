import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "../../src/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function template(id: string, name: string, amount: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat-home",
    startDate: "2026-10-28",
    dueDay: 28,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const rentStore: ExpenseStore = {
  ...emptyStore,
  categories: [{ id: "cat-home", userId: "demo", name: "Casa", icon: "Home", tone: "green" }],
  templates: [template("rent", "Alquiler", 700)],
};

const netflixBackup = JSON.stringify({
  kind: "expense-log-backup",
  version: 1,
  exportedAt: "2026-10-20T09:00:00.000Z",
  store: {
    ...emptyStore,
    categories: rentStore.categories,
    templates: [template("netflix", "Netflix", 12.99)],
  },
});

async function seed(page: Page, store: ExpenseStore) {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await page.addInitScript(
    ({ key, value }) => {
      // Solo la primera vez: las navegaciones siguientes ven lo guardado.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, value: store },
  );
}

function expenseRow(page: Page, name: string) {
  return page.locator('[data-expense-row="true"]').filter({ hasText: name });
}

// Se navega con los enlaces de la app: un page.goto mientras el service
// worker recién registrado se activa puede abortarse.
async function openExpenses(page: Page) {
  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function openSettings(page: Page) {
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
}

test("exports everything as JSON and the expenses as CSV", async ({ page }) => {
  await seed(page, rentStore);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Copias y datos" })).toBeVisible();

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar todo en JSON" }).click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toBe("expense-log-2026-10-23.json");
  const backup = JSON.parse(readFileSync((await json.path())!, "utf8"));
  expect(backup).toMatchObject({
    kind: "expense-log-backup",
    store: { templates: [{ id: "rent", name: "Alquiler" }] },
  });
  await expect(page.getByText("Archivo exportado: expense-log-2026-10-23.json")).toBeVisible();

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar gastos y pagos en CSV" }).click();
  const csv = readFileSync((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain("type,expense_id,name,category,amount");
  expect(csv).toContain("expense,rent,Alquiler,Casa,700.00");
});

test("replaces the data with a JSON backup and restores the previous copy", async ({
  page,
}) => {
  await seed(page, rentStore);
  await page.goto("/settings");

  await page.getByLabel("Archivo para importar").setInputFiles({
    name: "copia.json",
    mimeType: "application/json",
    buffer: Buffer.from(netflixBackup),
  });

  const preview = page.getByRole("dialog", { name: "Importar datos" });
  await expect(preview.getByText("copia.json")).toBeVisible();
  await expect(preview.getByText("El archivo trae 1 gasto · 0 pagos · 0 ingresos.")).toBeVisible();
  await expect(preview.getByText("Quedarán 2 gastos · 0 pagos · 0 ingresos.")).toBeVisible();
  await preview.getByRole("radio", { name: /Sustituir/ }).check();
  await expect(preview.getByText("Quedarán 1 gasto · 0 pagos · 0 ingresos.")).toBeVisible();
  await preview.getByRole("button", { name: "Sustituir datos" }).click();

  await expect(preview).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Datos importados" }),
  ).toBeVisible();

  await openExpenses(page);
  await expect(expenseRow(page, "Netflix").first()).toBeVisible();
  await expect(expenseRow(page, "Alquiler")).toHaveCount(0);

  await openSettings(page);
  await page.getByRole("button", { name: "Ver" }).click();
  const copies = page.getByRole("dialog", { name: "Copias automáticas" });
  const beforeImport = copies.locator('[data-snapshot-reason="before-import"]');
  await expect(beforeImport).toContainText("1 gasto");
  await beforeImport.getByRole("button", { name: /Restaurar la copia/ }).click();
  await expect(copies.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await copies.getByRole("button", { name: "Restaurar", exact: true }).click();

  await expect(copies).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Copia restaurada" })).toBeVisible();
  await openExpenses(page);
  await expect(expenseRow(page, "Alquiler").first()).toBeVisible();
  await expect(expenseRow(page, "Netflix")).toHaveCount(0);
});

test("merges a CSV saved by a spreadsheet in Spanish", async ({ page }) => {
  await seed(page, rentStore);
  await page.goto("/settings");

  await page.getByLabel("Archivo para importar").setInputFiles({
    name: "gastos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name;amount;frequency;due_day;start_date;category\r\nGimnasio;35,00;monthly;28;2026-10-28;Deporte\r\n;;;;;\r\n",
    ),
  });

  const preview = page.getByRole("dialog", { name: "Importar datos" });
  await expect(preview.getByText("CSV con gastos, pagos e histórico")).toBeVisible();
  await expect(preview.getByText("Quedarán 2 gastos · 0 pagos · 0 ingresos.")).toBeVisible();
  await preview.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(preview).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Datos importados" })).toBeVisible();

  await openExpenses(page);
  await expect(expenseRow(page, "Gimnasio").first()).toBeVisible();
  await expect(expenseRow(page, "Alquiler").first()).toBeVisible();
});

test("explains why a file cannot be imported", async ({ page }) => {
  await seed(page, rentStore);
  await page.goto("/settings");

  await page.getByLabel("Archivo para importar").setInputFiles({
    name: "otra-app.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });

  await expect(
    page.getByRole("status").filter({ hasText: "Ese JSON no es una copia de esta app." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Importar datos" })).toHaveCount(0);
});

test("keeps a daily copy on the device and shows storage protection", async ({ page }) => {
  await seed(page, rentStore);
  await page.goto("/settings");

  await expect(page.getByText("Almacenamiento persistente")).toBeVisible();
  // La copia diaria se guarda unos segundos después de abrir la app.
  await expect(page.getByText(/1 copia en este dispositivo/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Copias automáticas" })
      .locator('[data-snapshot-reason="daily"]'),
  ).toContainText("Copia diaria");
});
