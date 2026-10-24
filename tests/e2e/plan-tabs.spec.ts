import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
} from "../../src/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function template(
  id: string,
  name: string,
  amount: number,
  startDate: string,
  dueDay: number,
  recurrence: RecurrenceRule = { frequency: "monthly" },
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "home",
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function paid(templateId: string, occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    updatedAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

// 23 de octubre. Sueldo de 2000 € y 300 € de ahorro. Alquiler pagado; luz y
// gimnasio por pagar (90 €). La cuenta de recibos, Sabadell, tiene 1000 €.
// El IBI trimestral pide 50 €/mes hasta enero.
const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("rent", "Alquiler", 700, "2026-09-01", 1),
    template("power", "Luz", 60, "2026-09-25", 25),
    template("gym", "Gimnasio", 30, "2026-09-28", 28),
    template("ibi", "IBI", 150, "2026-01-10", 10, { frequency: "quarterly" }),
  ],
  overrides: [
    paid("rent", "2026-09-01"),
    paid("power", "2026-09-25"),
    paid("gym", "2026-09-28"),
    paid("rent", "2026-10-01"),
    paid("ibi", "2026-10-10"),
  ],
  finance: {
    ...emptyStore.finance,
    monthlySalary: {
      "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    monthlySavingsTargets: {
      "2026-01": { amount: 300, updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    balanceAccounts: {
      primary: {
        name: "Sabadell",
        role: "bills",
        order: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    },
    balanceCheckins: {
      "2026-10-20": { amount: 1000, updatedAt: "2026-10-20T10:00:00.000Z" },
    },
  },
};

async function seed(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, value: store },
  );
}

function headline(page: Page) {
  return page.locator("header[data-app-chrome]");
}

function monthBar(page: Page) {
  return page.getByRole("navigation", { name: "Cambiar de mes" });
}

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test("moves between the four tabs, each with its own headline", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await seed(page);
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Secciones" });
  const tabs = nav.getByRole("link");
  await expect(tabs).toHaveText(["Gastos", "Mes", "Cuentas", "Previsión"]);
  // A 360 px ninguna etiqueta se corta ni se sale de su pestaña.
  const clipped = await tabs.evaluateAll((links) =>
    links.flatMap((link) => {
      const label = link.querySelector("span");
      if (!label) return [link.textContent];
      const tab = link.getBoundingClientRect();
      const text = label.getBoundingClientRect();
      return label.scrollWidth > label.clientWidth + 1 ||
        text.left < tab.left - 1 ||
        text.right > tab.right + 1
        ? [link.textContent]
        : [];
    }),
  );
  expect(clipped).toEqual([]);

  // Gastos: lo que queda por pagar del mes.
  await expect(headline(page)).toContainText("Por pagar · octubre");
  await expect(headline(page)).toContainText(/90,00\s€/);
  await expect(monthBar(page)).toBeVisible();

  // Mes: lo libre según el plan (2000 − 940 − 300).
  await nav.getByRole("link", { name: "Mes" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(headline(page)).toContainText("Libre · octubre");
  await expect(headline(page)).toContainText(/760,00\s€/);
  await expect(monthBar(page)).toBeVisible();
  await expect(nav.getByRole("link", { name: "Mes" })).toHaveAttribute("aria-current", "page");
  expect(await noHorizontalScroll(page)).toBe(true);

  // Cuentas: 1000 € frente a los 90 € que quedan.
  await nav.getByRole("link", { name: "Cuentas" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(headline(page)).toContainText("Te sobran · Sabadell");
  await expect(headline(page)).toContainText(/910,00\s€/);
  await expect(page.getByRole("region", { name: "Cuentas" })).toBeVisible();
  await expect(monthBar(page)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Previsión: lo que hay que apartar al mes para los no mensuales.
  await nav.getByRole("link", { name: "Previsión" }).click();
  await expect(page).toHaveURL(/\/forecast$/);
  await expect(headline(page)).toContainText("Aparta al mes");
  await expect(headline(page)).toContainText(/37,50\s€/);
  await expect(page.getByRole("region", { name: "Próximos recibos grandes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Coste por categoría" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Plan anual" })).toBeVisible();
  await expect(monthBar(page)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Ajustes vuelve a la pestaña desde la que se abrió.
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/settings\?from=forecast$/);
  await page.getByRole("link", { name: "Previsión" }).click();
  await expect(page).toHaveURL(/\/forecast$/);

  await page.goto("/accounts");
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/settings\?from=accounts$/);
  await page.getByRole("link", { name: "Cuentas" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
});

test("Mes links the bills coverage to Cuentas and keeps the bills folded", async ({ page }) => {
  await seed(page);
  await page.goto("/money");

  const coverage = page.getByRole("link", { name: /Sabadell/ });
  await expect(coverage).toContainText(/Te sobran 910,00\s€/);

  const bills = page.getByRole("button", { name: /Recibos de octubre/ });
  await expect(bills).toHaveAttribute("aria-expanded", "false");
  await expect(bills).toContainText("2 pendientes · 90,00 €");
  await expect(page.locator(".app-monthly-expense-row")).toHaveCount(0);
  await bills.click();
  await expect(page.locator(".app-monthly-expense-row").first()).toContainText("Luz");

  await coverage.click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("region", { name: "Cuentas" })).toBeVisible();
});

test("the month summary holds the review actions", async ({ page }) => {
  await seed(page);
  await page.goto("/money");

  await page.getByRole("button", { name: /Resumen de octubre/ }).click();
  const summary = page.getByRole("dialog", { name: "Resumen de octubre" });
  await expect(summary).toBeVisible();
  // Sin selectores de año ni de mes: es el mes de la barra.
  await expect(summary.getByRole("combobox")).toHaveCount(0);
  await expect(summary.getByRole("heading", { name: /Cambios frente a septiembre/ })).toBeVisible();
  await expect(summary.getByRole("heading", { name: /Ingresos puntuales/ })).toBeVisible();

  // El ahorro se corrige encima del resumen.
  await summary.getByRole("button", { name: "Editar ahorro" }).click();
  const savings = page.getByRole("dialog", { name: "Editar ahorro" });
  await savings.getByLabel("Transferencia real").fill("250");
  await savings.getByRole("button", { name: "Guardar ahorro" }).click();
  await expect(savings).toHaveCount(0);
  await expect(summary).toBeVisible();
  await expect(summary.getByText(/250,00\s€/).first()).toBeVisible();

  await summary.getByRole("button", { name: "Editar ingreso fijo" }).click();
  const salary = page.getByRole("dialog", { name: "Editar sueldo del mes" });
  await expect(salary).toContainText("octubre 2026");
  await page.goBack();
  await expect(salary).toHaveCount(0);
  await expect(summary).toBeVisible();
  await page.goBack();
  await expect(summary).toHaveCount(0);
  await expect(page).toHaveURL(/\/money$/);

  // En un mes ya pasado sin ahorro apuntado, el resumen lo avisa.
  await page.getByRole("button", { name: "Mes anterior" }).click();
  await page.getByRole("button", { name: /Resumen de septiembre/ }).click();
  const september = page.getByRole("dialog", { name: "Resumen de septiembre" });
  await expect(september).toContainText("Objetivo de ahorro no registrado");
  await september.getByRole("button", { name: "Registrar ahorro" }).click();
  await expect(page.getByRole("dialog", { name: "Editar ahorro" })).toContainText(
    "septiembre 2026",
  );
});

test("changes the salary and savings from Settings", async ({ page }) => {
  await seed(page);
  await page.goto("/settings?from=money");

  await expect(page.getByText(/Sueldo 2\.?000,00\s€ · día 28 · ahorro 300,00\s€/)).toBeVisible();
  await page.getByRole("button", { name: "Cambiar sueldo y ahorro" }).click();
  const sheet = page.getByRole("dialog", { name: "Base del plan" });
  await sheet.getByLabel("Sueldo").fill("2400");
  await sheet.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText(/Sueldo 2\.?400,00\s€ · día 28/)).toBeVisible();

  await page.getByRole("link", { name: "Mes" }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(headline(page)).toContainText(/1\.?160,00\s€/);
});
