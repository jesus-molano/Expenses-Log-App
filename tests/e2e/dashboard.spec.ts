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
  // En móvil, Intro hace otra línea: se analiza con el botón.
  await page.getByPlaceholder("Ej: Luz 64,75 mensual día 8").press("Enter");
  await expect(page.getByPlaceholder("Ej: Luz 64,75 mensual día 8")).toHaveValue(/\n$/);
  await page.getByRole("button", { name: "Analizar texto" }).click();

  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  await expect(form.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  // El borrador viene del análisis local: se avisa de por qué.
  await expect(form.getByText("IA no configurada. Análisis local usado.")).toBeVisible();
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

  const tooltipRows = page.locator(".app-chart-tooltip-row");
  // La animación inicial de recharts vuelve a montar las barras: si el hover
  // cae sobre una barra que se desmonta, se repite.
  await expect(async () => {
    await page.locator(".recharts-bar-rectangle").first().hover({ force: true });
    await expect(tooltipRows).toHaveCount(3, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
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
  await expect(closeButton).toBeFocused();
  // La captura por texto va primero; el alta manual queda como alternativa.
  await expect(dialog.getByRole("textbox", { name: "Analizar texto" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Analizar texto" })).toHaveClass(
    /app-button-primary/,
  );

  await page.keyboard.press("Shift+Tab");
  await expect(manualButton).toBeFocused();

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

test("mobile shell routes render without runtime errors", async ({ page }) => {
  await loadDemoStore(page);

  for (const route of ["/", "/money", "/settings", "/expenses/new"]) {
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  }
});

test("reviews and saves several expenses captured at once", async ({ page }) => {
  await loadDemoStore(page);
  await page.route("**/api/ai/parse-expenses", async (route) => {
    const draft = (name: string, amount: number, dueDay: number) => ({
      name,
      description: "",
      amount,
      categoryName: "Suscripciones",
      startDate: "2026-06-01",
      dueDay,
      recurrence: { frequency: "monthly" },
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "gemini",
        expenses: [
          draft("Tidal", 10.99, 3),
          draft("Audible", 0, 9),
          draft("Dropbox", 11.99, 14),
          draft("Deezer", 9.99, 20),
        ],
        review: [
          { missingFields: [], inferredFields: [] },
          { missingFields: ["amount"], inferredFields: [] },
          { missingFields: [], inferredFields: ["dueDay"] },
          { missingFields: [], inferredFields: [] },
        ],
      }),
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page.getByRole("button", { name: "Netflix 12,99 el 5" }).click();
  await page.getByRole("button", { name: "Analizar texto" }).click();

  const review = page.getByRole("dialog", { name: "Revisa los gastos" });
  await expect(review).toBeVisible();
  await expect(review.getByText("Falta el importe")).toBeVisible();
  await expect(review.getByText("Revisa: día de cobro")).toBeVisible();
  await expect(review.getByRole("checkbox", { name: "Incluir Audible" })).toBeDisabled();

  // Desmarcar uno y editar otro no vuelve a marcar el primero.
  await review.getByRole("checkbox", { name: "Incluir Tidal" }).uncheck();
  await expect(review.getByRole("button", { name: "Guardar 2" })).toBeVisible();
  await review.getByRole("button", { name: "Editar: Dropbox" }).click();
  await page.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(review).toBeVisible();
  await expect(review.getByRole("checkbox", { name: "Incluir Tidal" })).not.toBeChecked();
  await review.getByRole("button", { name: "Guardar 1" }).click();

  await expect(review).toBeHidden();
  const rows = page.locator('[data-expense-row="true"]');
  await expect(rows.filter({ hasText: "Dropbox" }).first()).toBeAttached();
  await expect(rows.filter({ hasText: "Deezer" }).first()).toBeAttached();
  await expect(rows.filter({ hasText: "Tidal" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Audible" })).toHaveCount(0);
});

test("cancels an analysis without starting another one", async ({ page }) => {
  await loadDemoStore(page);
  let requests = 0;
  await page.route("**/api/ai/parse-expenses", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.abort().catch(() => undefined);
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page.getByRole("button", { name: "Netflix 12,99 el 5" }).click();
  await page.getByRole("button", { name: "Analizar texto" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await expect(page.getByRole("button", { name: "Analizar texto" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toBe(1);
  await expect(page.getByRole("dialog", { name: "Nuevo gasto" })).toHaveCount(0);
});

async function fakeDictation(page: Page) {
  await loadDemoStore(page);
  // Reconocedor falso: devuelve una frase final poco después de arrancar.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: "Netflix 12,99 el 5" } }],
          });
        }, 200);
      }
      stop() {}
      abort() {}
    }
    // Chromium trae SpeechRecognition sin prefijo; se sustituyen los dos.
    Object.assign(window, {
      SpeechRecognition: FakeRecognition,
      webkitSpeechRecognition: FakeRecognition,
    });
  });
  const sent: string[] = [];
  await page.route("**/api/ai/parse-expenses", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}").text);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "gemini",
        expenses: [
          {
            name: "Netflix",
            description: "",
            amount: 12.99,
            categoryName: "Suscripciones",
            startDate: "2026-06-01",
            dueDay: 5,
            recurrence: { frequency: "monthly" },
          },
        ],
        review: [{ missingFields: [], inferredFields: [] }],
      }),
    });
  });
  await page.goto("/expenses/new?mode=voice");

  const dictate = page.getByRole("button", { name: "Dictar" });
  await expect(dictate).toBeVisible();
  await dictate.click();
  await expect(page.getByText("Escuchando…")).toBeVisible();
  return sent;
}

test("dictates an expense and reviews it in the form", async ({ page }) => {
  const sent = await fakeDictation(page);

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible({ timeout: 6_000 });
  expect(sent).toEqual(["Netflix 12,99 el 5"]);
});

test("analyzing while dictating ends the dictation and sends the text once", async ({ page }) => {
  const sent = await fakeDictation(page);

  await expect(page.getByPlaceholder("Ej: Luz 64,75 mensual día 8")).toHaveValue("Netflix 12,99 el 5");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();
  // Pasado el plazo de silencio no llega un segundo análisis.
  await page.waitForTimeout(2_500);
  expect(sent).toEqual(["Netflix 12,99 el 5"]);
});

test("Back closes the open sheet instead of leaving the screen", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/money");
  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page).toHaveURL(/\/$/);

  const addButton = page.getByRole("button", { name: "Añadir gasto" });
  const capture = page.getByRole("dialog", { name: "Añadir gasto" });

  await addButton.click();
  await expect(capture).toBeVisible();
  await page.goBack();
  await expect(capture).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);

  // Cerrar con la X no deja una entrada suelta en el historial.
  await addButton.click();
  await capture.getByRole("button", { name: "Cerrar" }).click();
  await expect(capture).toHaveCount(0);

  // De la captura al formulario: el formulario no se cierra solo.
  await addButton.click();
  await capture.getByRole("button", { name: "Manual" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  await expect(form).toBeVisible();
  await page.waitForTimeout(300);
  await expect(form).toBeVisible();
  await page.goBack();
  await expect(form).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/money$/);
});

test("Back closes an open date picker before the form that holds it", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/money");
  await page.getByRole("link", { name: "Gastos" }).click();
  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page.getByRole("dialog", { name: "Añadir gasto" }).getByRole("button", { name: "Manual" }).click();

  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "Fecha de inicio" }).click();
  const picker = page.getByRole("dialog", { name: "Fecha de inicio" });
  await expect(picker).toBeVisible();

  await page.goBack();
  await expect(picker).toHaveCount(0);
  await expect(form).toBeVisible();

  await page.goBack();
  await expect(form).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("the add expense shortcut opens the form only once", async ({ page }) => {
  await loadDemoStore(page);
  await page.goto("/expenses/new");
  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "Cerrar" }).click();
  await expect(form).toHaveCount(0);

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/expenses\/new$/);
  await expect(page.getByRole("button", { name: "Añadir gasto" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(form).toHaveCount(0);
});
