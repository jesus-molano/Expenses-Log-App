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
  await page.locator("summary").filter({ hasText: "Analizar texto" }).click();
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

test("edits plan settings and monthly savings without losing either value", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Plan de/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumen del mes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recibos pendientes" })).toBeVisible();

  await page.getByRole("button", { name: "Configurar" }).click();
  await expect(page.getByRole("heading", { name: "Base del plan" })).toBeVisible();

  await page.getByLabel("Sueldo").fill("3000");
  await page.getByLabel("Objetivo habitual de ahorro").fill("450");
  await page.getByRole("button", { name: /Cambiar día de cobro/ }).click();
  await page.getByRole("button", { name: "25" }).click();
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText(/Fijo 3\.?000,00\s*€/)).toBeVisible();

  await page.getByRole("button", { name: /Ahorro de este mes/ }).click();
  await expect(page.getByText(/Objetivo mensual: 450,00\s*€/)).toBeVisible();
  await page.getByLabel("Transferencia real").fill("325");
  await page.getByRole("button", { name: "Guardar ahorro" }).click();

  const savingsAction = page.getByRole("button", { name: /Ahorro de este mes/ });
  await expect(savingsAction).toContainText("Real 325,00 €");
  await expect(savingsAction).toContainText("objetivo 450,00 €");
});

test("marks a pending receipt as paid directly from plan", async ({ page }) => {
  await page.setViewportSize({ width: 481, height: 881 });
  await loadDemoStore(page);
  await page.goto("/money");

  const payButton = page.getByRole("button", {
    name: "Marcar Movistar como pagado",
  });
  await expect(payButton).toBeVisible();
  const expenseRow = page.locator(".app-monthly-expense-row").filter({
    has: payButton,
  });
  const actionButtons = expenseRow.getByRole("button");
  await expect(actionButtons).toHaveCount(3);
  const actionTops = await actionButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().top),
  );
  expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThanOrEqual(1);
  await payButton.click();

  await expect(payButton).toHaveCount(0);
});

test("shows a color marker for every annual chart series", async ({ page }) => {
  await page.setViewportSize({ width: 481, height: 881 });
  await loadDemoStore(page);
  await page.goto("/money");

  const chart = page.locator(".recharts-wrapper");
  await expect(chart).toBeVisible();
  await chart.scrollIntoViewIfNeeded();
  await page.locator(".recharts-bar-rectangle").first().hover({ force: true });

  const tooltipRows = page.locator(".app-chart-tooltip-row");
  await expect(tooltipRows).toHaveCount(3);
  const markerColors = await tooltipRows.evaluateAll((rows) =>
    rows.map((row) => {
      const marker = row.querySelector<HTMLElement>('[aria-hidden="true"]');
      return marker ? getComputedStyle(marker).backgroundColor : "";
    }),
  );

  expect(markerColors).toHaveLength(3);
  expect(markerColors.every((color) => color && color !== "rgba(0, 0, 0, 0)"))
    .toBe(true);
});

test("sheet closes with Escape and restores focus", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/");

  const addButton = page.getByRole("button", { name: "Añadir gasto" });
  await addButton.click();

  const dialog = page.getByRole("dialog", { name: "Añadir gasto" });
  await expect(dialog).toBeVisible();

  const closeButton = dialog.getByRole("button", { name: "Cerrar" });
  const manualButton = dialog.getByRole("button", { name: "Manual" });
  const textSummary = dialog.locator("summary");
  await expect(closeButton).toBeFocused();
  await expect(manualButton).toHaveClass(/app-button-primary/);

  await page.keyboard.press("Shift+Tab");
  await expect(textSummary).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(dialog).toHaveCount(0);
  await expect(addButton).toBeFocused();
});

test("compact menus support keyboard navigation and Escape", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/settings");

  await expect(page.getByText("Importar movimientos bancarios")).toHaveCount(0);

  await page.getByRole("button", { name: /Vice Afterglow/ }).click();
  const themeMenu = page.getByRole("listbox");
  await expect(themeMenu).toBeVisible();
  await expect(page.getByRole("option", { name: /Tokyo Night City/ }))
    .toBeInViewport({ ratio: 0.95 });
  await expect
    .poll(() =>
      page.locator(".app-settings-card").evaluate(
        (element) => getComputedStyle(element).overflow,
      ),
    )
    .toBe("visible");
  await page.keyboard.press("Escape");
  await expect(themeMenu).toHaveCount(0);

  const languageButton = page.getByRole("button", { name: "ES", exact: true });
  await languageButton.focus();
  await page.keyboard.press("ArrowDown");

  const languageMenu = page.getByRole("listbox");
  await expect(languageMenu).toBeVisible();
  await expect(page.getByRole("option", { name: /Español/ })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: /English/ })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(languageMenu).toHaveCount(0);
  await expect(languageButton).toBeFocused();
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
