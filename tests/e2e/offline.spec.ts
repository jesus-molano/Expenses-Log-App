import { expect, test } from "@playwright/test";
import { demoStore } from "../../src/domain/seed";

const storageKey = "expense-log-store-v1";

async function waitForServiceWorkerControl(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller),
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

test("loads and edits the main app routes after going offline", async ({
  context,
  page,
}) => {
  await context.addInitScript(
    ({ key, store }) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(store));
      }
    },
    { key: storageKey, store: demoStore },
  );

  await page.goto("/");
  await expect(page.getByText("Por pagar")).toBeVisible();
  await waitForServiceWorkerControl(page);

  await context.setOffline(true);

  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/settings\?from=expenses$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ajustes" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Por pagar")).toBeVisible();

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Plan de/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/settings\?from=money$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ajustes" }),
  ).toBeVisible();

  const expensesPage = await context.newPage();
  await expensesPage.goto("/", { waitUntil: "domcontentloaded" });
  await expect(expensesPage.getByText("Por pagar")).toBeVisible();

  const moneyPage = await context.newPage();
  await moneyPage.goto("/money", { waitUntil: "domcontentloaded" });
  await expect(
    moneyPage.getByRole("heading", { level: 1, name: /Plan de/ }),
  ).toBeVisible();
  await moneyPage
    .getByRole("button", { name: "Marcar Movistar como pagado" })
    .click();
  await expect(
    moneyPage.getByRole("button", { name: "Marcar Movistar como pagado" }),
  ).toHaveCount(0);

  const settingsPage = await context.newPage();
  await settingsPage.goto("/settings?from=money", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    settingsPage.getByRole("heading", { level: 1, name: "Ajustes" }),
  ).toBeVisible();
  await expect(settingsPage.getByRole("link", { name: "Plan" })).toBeVisible();
});
