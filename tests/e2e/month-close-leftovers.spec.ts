import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "../../src/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function template(id: string, name: string, dueDay: number, amount: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "home",
    startDate: `2026-09-${String(dueDay).padStart(2, "0")}`,
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function paid(templateId: string, occurrenceDate: string) {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid" as const,
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    updatedAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

// Cobro el 28. Septiembre pagado; de octubre quedan internet (atrasado) y el
// gimnasio del 30; el alquiler de noviembre ya está pagado.
const octoberWithLeftovers: ExpenseStore = {
  ...emptyStore,
  finance: {
    ...emptyStore.finance,
    monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 28 } },
    monthlySavingsTargets: { "2026-09": 300 },
  },
  templates: [
    template("rent", "Alquiler", 1, 700),
    template("internet", "Internet", 20, 30),
    template("gym", "Gimnasio", 30, 45),
  ],
  overrides: [
    paid("rent", "2026-09-01"),
    paid("internet", "2026-09-20"),
    paid("gym", "2026-09-30"),
    paid("rent", "2026-10-01"),
    paid("rent", "2026-11-01"),
  ],
};

async function seed(page: Page, store: ExpenseStore) {
  await page.addInitScript(
    ({ key, value }) => {
      // Solo la primera vez: una recarga debe ver lo guardado por la app.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, value: store },
  );
}

async function sectionIds(page: Page) {
  return page
    .locator("[data-section-id]")
    .evaluateAll((sections) => sections.map((section) => section.getAttribute("data-section-id")));
}

test("closes October with leftovers after payday and starts November", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await seed(page, octoberWithLeftovers);
  await page.goto("/");

  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cierre de octubre" })).toBeVisible();
  await expect(
    page.getByText("Quedan 2 recibos · 75,00 € · 1 pagado · 1 de noviembre ya pagado"),
  ).toBeVisible();

  // Lo prepagado de noviembre se ve en noviembre, no en octubre.
  const ids = await sectionIds(page);
  expect(ids[0]).toBe("paid-2026-10-01");
  expect(ids).toContain("today");
  expect(ids).not.toContain("paid-ahead-2026-11");

  await page.getByRole("button", { name: "Cerrar octubre" }).click();
  const sheet = page.getByRole("dialog", { name: "Cerrar octubre" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("2 · 75,00 €")).toBeVisible();
  // A 360 px la hoja no provoca scroll horizontal.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);

  await sheet.getByRole("button", { name: "Pagado: Internet" }).click();
  await expect(sheet.getByRole("button", { name: "Deshacer: Internet · Pagado" })).toBeFocused();
  await sheet.getByRole("button", { name: "Mover a noviembre: Gimnasio" }).click();
  await expect(sheet.getByText("Movido a noviembre")).toBeVisible();
  await expect(sheet.getByText("Nada pendiente en octubre.")).toBeVisible();
  await sheet.getByLabel("Ahorro real de octubre").fill("250");
  await sheet.getByRole("button", { name: "Empezar noviembre" }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Noviembre activo" })).toBeVisible();
  // Noviembre: gimnasio movido (45) + internet (30) + gimnasio del 30 (45).
  await expect(page.getByText("120,00 €").first()).toBeVisible();
  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Gimnasio" }).first(),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();

  // Plan sigue al mes activo y cuenta hasta el cobro de noviembre.
  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Plan de noviembre 2026/i })).toBeVisible();
  const outlook = page.locator('[data-payday-outlook="true"]');
  await expect(outlook).toContainText("Hasta el cobro (sáb 28 nov · 31 días)");
  await expect(outlook).toContainText("75,00 €");

  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Plan de octubre 2026/i })).toBeVisible();
  await expect(page.getByText("Registrado").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Ahorro de octubre/ })).toContainText("250,00 €");
  await expect(outlook).toHaveCount(0);
});

test("an unresolved leftover waits as carry-over once November starts", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await seed(page, octoberWithLeftovers);
  await page.goto("/");

  await page.getByRole("button", { name: "Cerrar octubre" }).click();
  await page
    .getByRole("dialog", { name: "Cerrar octubre" })
    .getByRole("button", { name: "Empezar noviembre" })
    .click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  // Mirando noviembre antes de que empiece no hay Hoy, sino cuánto falta.
  expect(await sectionIds(page)).not.toContain("today");
  await expect(page.getByText(/noviembre empieza en 4 días/i)).toBeVisible();

  await page.clock.setFixedTime(new Date("2026-11-01T00:05:00"));
  await page.reload();

  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  // El cierre de octubre ya no importa: noviembre es el mes natural.
  await expect(page.getByRole("button", { name: "Volver a octubre" })).toHaveCount(0);
  const carryOver = page.locator('[data-section-id="carry-over-2026-10"]');
  await expect(carryOver).toContainText("Pendiente de octubre");
  await expect(carryOver).toContainText("Internet");
  await expect(carryOver).toContainText("Gimnasio");
  expect(await sectionIds(page)).toContain("today");

  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(page.getByText("75,00 €").first()).toBeVisible();
  expect(await sectionIds(page)).not.toContain("today");
});

test("Plan follows the month viewed in Gastos and pays from the review", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await seed(page, octoberWithLeftovers);
  await page.goto("/");

  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Plan de noviembre 2026/i })).toBeVisible();
  await expect(page.getByText("Proyectado").first()).toBeVisible();
  await expect(page.locator('[data-payday-outlook="true"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Ir a octubre" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Plan de octubre 2026/i })).toBeVisible();
  await expect(page.locator('[data-payday-outlook="true"]')).toContainText(
    "Hasta el cobro (sáb 28 nov · 31 días)",
  );

  const review = page.getByRole("region", { name: "Revisión mensual" });
  const payInternet = review.getByRole("button", { name: "Marcar Internet como pagado" });
  await payInternet.scrollIntoViewIfNeeded();
  await payInternet.click();
  await expect(payInternet).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Recibos pendientes" }).getByText("Internet"),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(page.getByText("45,00 €").first()).toBeVisible();
});

test("offers next year in December", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-15T10:00:00"));
  await seed(page, octoberWithLeftovers);
  await page.goto("/money");

  const annualYear = page
    .getByRole("region", { name: "Plan anual" })
    .getByRole("combobox", { name: "Año" });
  await expect(annualYear.locator("option", { hasText: "2027" })).toHaveCount(1);
});

test("asks how to count the charges before this month of a new expense", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await seed(page, { ...emptyStore });
  await page.route("**/api/ai/parse-expenses", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "local",
        reason: "missing_key",
        expenses: [
          {
            name: "Seguro hogar",
            description: "",
            amount: 25,
            categoryName: "Casa",
            startDate: "2026-07-05",
            dueDay: 5,
            recurrence: { frequency: "monthly" },
          },
        ],
      }),
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page.getByPlaceholder("Ej: Luz 64,75 mensual día 8").fill("Seguro hogar 25 desde julio");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  const previous = form.getByRole("group", { name: "Empezó antes de octubre" });
  await expect(previous).toContainText("Hay 3 cobros anteriores a octubre.");
  await expect(previous.getByRole("button", { name: "Pagados" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await form.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(form).toBeHidden();

  // Septiembre ya no reclama el seguro: quedó pagado.
  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByText("Por pagar · septiembre")).toBeVisible();
  await expect(page.getByText("0,00 €").first()).toBeVisible();
  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Seguro hogar" }).first(),
  ).toContainText(/pagado/i);
});
