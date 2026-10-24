import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "../../src/domain/types";

// F3: primeros pasos, catálogo "Todos", datos de contrato y categorías
// propias, y órdenes en la captura. El reloj se fija al viernes 23-oct-2026.

const STORAGE_KEY = "expense-log-store-v1";
const NOW = new Date("2026-10-23T10:00:00");

function template(
  id: string,
  name: string,
  dueDay: number,
  amount: number,
  extra: Partial<ExpenseTemplate> = {},
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "casa",
    startDate: "2026-01-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

const categories: ExpenseStore["categories"] = [
  { id: "casa", userId: "demo", name: "Casa", icon: "Home", tone: "green" },
  { id: "subs", userId: "demo", name: "Suscripciones", icon: "Sparkles", tone: "violet" },
  { id: "coche", userId: "demo", name: "Vehiculo", icon: "Car", tone: "orange" },
  { id: "viajes", userId: "demo", name: "Viajes", icon: "Tag", tone: "rose" },
];

const store: ExpenseStore = {
  ...emptyStore,
  categories,
  templates: [
    template("luz", "Luz", 8, 60),
    template("gym", "Gimnasio", 1, 35, { endDate: "2026-09-30" }),
    template("netflix", "Netflix", 28, 12.99, {
      categoryId: "subs",
      notes: "Plan estándar compartido",
      commitmentEndDate: "2026-11-10",
    }),
    template("seguro", "Seguro coche", 15, 420, {
      categoryId: "coche",
      recurrence: { frequency: "yearly", annualMonth: 3 },
    }),
    template("vuelo", "Vuelo Lisboa", 12, 90, {
      categoryId: "viajes",
      recurrence: { frequency: "once" },
      startDate: "2026-11-12",
    }),
  ],
};

// Siembra el store solo la primera vez: una recarga ve lo que guardó la app.
async function seed(page: Page, seeded: ExpenseStore) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, value: seeded },
  );
}

async function savedStore(page: Page): Promise<ExpenseStore> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), STORAGE_KEY);
}

function row(page: Page, name: string) {
  return page.locator('[data-expense-row="true"]').filter({ hasText: name }).first();
}

test("guides a new user with quick-add chips and a checklist", async ({ page }) => {
  await seed(page, emptyStore);
  await page.goto("/");

  const guide = page.getByRole("region", { name: "Empieza por tus gastos fijos" });
  await expect(guide).toBeVisible();
  await expect(guide.getByText("0 de 4")).toBeVisible();

  await guide.getByRole("button", { name: "Añadir Alquiler" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo gasto" });
  await expect(form.getByPlaceholder("Netflix, alquiler, seguro...")).toHaveValue("Alquiler");
  // Solo falta el importe.
  await expect(form.getByPlaceholder("15,99")).toHaveValue("");
  await form.getByPlaceholder("15,99").fill("850");
  await form.getByRole("button", { name: "Guardar gasto" }).click();

  await expect(row(page, "Alquiler")).toBeVisible();
  await expect(guide.getByRole("button", { name: "Añadir Alquiler" })).toHaveCount(0);
  await expect(guide.getByText("1 de 4")).toBeVisible();

  await guide.getByRole("button", { name: "Configurar" }).click();
  await page.getByLabel("Sueldo").fill("2000");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(guide.getByText("2 de 4")).toBeVisible();

  // Empezó aquí: sigue a la vista tras recargar hasta que se oculta.
  await page.reload();
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Ocultar primeros pasos" }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(row(page, "Alquiler")).toBeVisible();
  await expect(guide).toHaveCount(0);
});

test("does not show the guide to someone who already has expenses", async ({ page }) => {
  await seed(page, store);
  await page.goto("/");

  await expect(row(page, "Luz")).toBeVisible();
  await expect(page.getByRole("region", { name: "Empieza por tus gastos fijos" })).toHaveCount(0);
});

test("lists every series with search and filters from the header", async ({ page }) => {
  await seed(page, store);
  await page.goto("/");

  const open = page.getByRole("button", { name: /^Todos los gastos/ });
  await expect(open).toHaveAccessibleName("Todos los gastos · 1 permanencia acaba pronto");
  await open.click();

  const catalog = page.getByRole("dialog", { name: "Todos tus gastos" });
  const items = catalog.getByRole("link");
  await expect(items).toHaveCount(4);
  await expect(catalog.getByText("Permanencia: 18 d")).toBeVisible();

  // Busca también en las notas, sin tildes.
  await catalog.getByRole("searchbox", { name: "Buscar gastos" }).fill("estandar");
  await expect(items).toHaveCount(1);
  await expect(catalog.getByRole("link", { name: /Netflix/ })).toBeVisible();
  await catalog.getByRole("button", { name: "Quitar filtros" }).click();

  await catalog.getByRole("button", { name: "Finalizados" }).click();
  await expect(items).toHaveCount(1);
  await expect(catalog.getByRole("link", { name: /Gimnasio/ })).toContainText("Finalizado el 30");

  await catalog.getByRole("button", { name: "Todos", exact: true }).click();
  await catalog.getByRole("button", { name: /^Frecuencia/ }).click();
  await page.getByRole("option", { name: "Anuales" }).click();
  await expect(items).toHaveCount(1);

  await catalog.getByRole("link", { name: /Seguro coche/ }).click();
  await expect(page).toHaveURL(/\/expenses\/seguro$/);
  await expect(page.getByRole("heading", { name: "Seguro coche" })).toBeVisible();
});

test("keeps the frequency menu inside the catalog sheet when it is short", async ({ page }) => {
  await seed(page, store);
  await page.goto("/");
  await page.getByRole("button", { name: /^Todos los gastos/ }).click();

  const catalog = page.getByRole("dialog", { name: "Todos tus gastos" });
  // Sin resultados la hoja queda baja: abrir el menú hacia arriba la desborda.
  await catalog.getByRole("searchbox", { name: "Buscar gastos" }).fill("nada que coincida");
  await expect(catalog.getByText("Ningún gasto coincide.")).toBeVisible();
  await catalog.getByRole("button", { name: /^Frecuencia/ }).click();

  const first = page.getByRole("option", { name: "Cualquier frecuencia" });
  await expect(first).toBeVisible();
  const menuBox = await page.locator(".app-select-menu-panel").boundingBox();
  const sheetBox = await catalog.boundingBox();
  expect(menuBox!.y).toBeGreaterThanOrEqual(sheetBox!.y);
  await page.getByRole("option", { name: "Otras" }).scrollIntoViewIfNeeded();
  await page.getByRole("option", { name: "Otras" }).click();
  await expect(catalog.getByRole("button", { name: "Frecuencia: Otras" })).toBeVisible();

  // Se puede volver a abrir y elegir la primera opción. Justo después de
  // elegir, el menú ignora un instante el toque fantasma en su botón.
  await expect(async () => {
    await catalog.getByRole("button", { name: /^Frecuencia/ }).click();
    await expect(first).toBeVisible({ timeout: 1000 });
  }).toPass();
  await first.click();
  await expect(catalog.getByRole("button", { name: "Frecuencia: Cualquier frecuencia" })).toBeVisible();
});

test("saves contract details and a new category from the expense form", async ({ page }) => {
  await seed(page, store);
  await page.goto("/expenses/netflix");

  // La permanencia acaba en menos de 30 días: se avisa en el detalle.
  const summary = page.getByRole("region", { name: "Datos del contrato" });
  await expect(summary.getByText("La permanencia acaba en 18 días (10 nov 2026)")).toBeVisible();

  // Abierta porque el gasto ya tiene notas.
  await expect(page.getByRole("button", { name: /Contrato y pago/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("button", { name: "Tarjeta" }).click();
  await page.getByPlaceholder("Visa ···4321, cuenta BBVA...").fill("Visa 4321");
  const cancellation = page.getByPlaceholder("netflix.com/cancelplan");
  await cancellation.fill("javascript:alert(1)");
  await expect(
    page.getByRole("alert").filter({ hasText: "Escribe un enlace web" }),
  ).toBeVisible();
  await cancellation.fill("netflix.com/cancelplan");

  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByPlaceholder("Viajes, Bebé, Regalos...").fill("Streaming");
  await page.getByRole("radio", { name: "Azul" }).click();
  await page.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByRole("button", { name: "Streaming", pressed: true })).toBeVisible();

  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/expenses/netflix");
  await expect(summary.getByText("Tarjeta · Visa 4321")).toBeVisible();
  await expect(
    summary.getByRole("link", { name: /Abrir el enlace para darse de baja de Netflix/ }),
  ).toHaveAttribute("href", "https://netflix.com/cancelplan");
  await expect(page.getByRole("button", { name: "Streaming", pressed: true })).toBeVisible();

  const saved = await savedStore(page);
  const streaming = saved.categories.find((category) => category.name === "Streaming");
  expect(streaming).toMatchObject({ tone: "blue", icon: "Tag" });
  expect(saved.templates.find((item) => item.id === "netflix")).toMatchObject({
    categoryId: streaming?.id,
    paymentMethod: "card",
    paymentMethodDetail: "Visa 4321",
    cancellationUrl: "https://netflix.com/cancelplan",
    notes: "Plan estándar compartido",
  });
});

test("renames and deletes a category moving its expenses", async ({ page }) => {
  await seed(page, store);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Gestionar" }).click();
  const manager = page.getByRole("dialog", { name: "Categorías" });
  await manager.getByRole("button", { name: "Editar Viajes" }).click();
  await manager.getByPlaceholder("Viajes, Bebé, Regalos...").fill("Casa");
  await manager.getByRole("button", { name: "Guardar" }).click();
  await expect(manager.getByRole("alert")).toHaveText("Ya tienes una categoría con ese nombre.");
  await manager.getByPlaceholder("Viajes, Bebé, Regalos...").fill("Vacaciones");
  await manager.getByRole("button", { name: "Guardar" }).click();
  await expect(manager.getByText("Vacaciones")).toBeVisible();

  await manager.getByRole("button", { name: "Borrar Vacaciones" }).click();
  await expect(manager.getByText("1 gasto la usa. Pásalo a:")).toBeVisible();
  await manager.getByRole("button", { name: /^Pasar a/ }).click();
  await page.getByRole("option", { name: "Casa" }).click();
  await manager.getByRole("button", { name: "Borrar", exact: true }).click();
  // La confirmación común, con el destino elegido.
  const confirm = page.getByRole("alertdialog", { name: "¿Borrar «Vacaciones»?" });
  await expect(confirm).toContainText("Lo que la usa pasa a «Casa».");
  await confirm.getByRole("button", { name: "Borrar", exact: true }).click();
  await expect(manager.getByText("Vacaciones")).toHaveCount(0);

  const saved = await savedStore(page);
  expect(saved.categories.map((category) => category.id)).not.toContain("viajes");
  expect(saved.deleted?.categories).toContain("viajes");
  expect(saved.templates.find((item) => item.id === "vuelo")?.categoryId).toBe("casa");
});

test("confirms spoken orders before applying them, with undo", async ({ page }) => {
  await seed(page, store);
  await page.route("**/api/ai/parse-expenses", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "gemini",
        expenses: [],
        review: [],
        commands: [
          { intent: "pay", target: "Luz", amount: 71.2, day: null, date: null, month: null },
          { intent: "skip", target: "Seguro", amount: null, day: null, date: null, month: null },
        ],
      }),
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page
    .getByPlaceholder("Ej: Luz 64,75 mensual día 8")
    .fill("marca la luz pagada 71,20 y salta el seguro");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  const review = page.getByRole("dialog", { name: "Confirma los cambios" });
  await expect(review.getByText("Marcar como pagado: Luz")).toBeVisible();
  // Nada cambia hasta confirmar.
  expect((await savedStore(page)).overrides).toEqual([]);
  await expect(review.getByRole("button", { name: "Aplicar 2" })).toBeVisible();
  await review.getByRole("button", { name: "Aplicar 2" }).click();

  await expect(page.getByRole("status").filter({ hasText: "2 cambios aplicados" })).toBeVisible();
  await expect(row(page, "Luz")).toContainText("pagado");
  const applied = await savedStore(page);
  expect(applied.overrides).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ templateId: "luz", status: "paid", amountPaid: 71.2 }),
      expect.objectContaining({ templateId: "seguro", status: "skipped" }),
    ]),
  );

  // La luz se pagó con otro importe: la misma pregunta que en las acciones
  // del cobro. El aviso con "Deshacer" espera a que se conteste.
  const question = page.getByRole("dialog", { name: "¿Actualizar el importe desde ahora?" });
  await expect(question).toContainText("Los próximos cobros de Luz");
  await question.getByRole("button", { name: "Solo este cobro" }).click();
  await expect(question).toHaveCount(0);
  expect((await savedStore(page)).templates.find((item) => item.id === "luz")?.amount).toBe(60);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(row(page, "Luz")).not.toContainText("pagado");
});

test("understands orders offline and can move the whole series", async ({ page }) => {
  await seed(page, store);
  // Sin IA: el parser local entiende la misma orden.
  await page.route("**/api/ai/parse-expenses", (route) => route.abort());
  await page.goto("/");

  await page.getByRole("button", { name: "Añadir gasto" }).click();
  await page.getByPlaceholder("Ej: Luz 64,75 mensual día 8").fill("mueve Netflix al 10");
  await page.getByRole("button", { name: "Analizar texto" }).click();

  const review = page.getByRole("dialog", { name: "Confirma los cambios" });
  await expect(review.getByText("Mover el cobro: Netflix")).toBeVisible();
  await expect(review.getByText("Del 28 oct al 10 oct")).toBeVisible();
  await review.getByRole("button", { name: "Este y siguientes" }).click();
  await review.getByRole("button", { name: "Aplicar 1" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Cambio aplicado" })).toBeVisible();
  const saved = await savedStore(page);
  expect(saved.templates.find((item) => item.id === "netflix")?.dueDay).toBe(10);
});
