import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
} from "../../src/domain/types";

const STORAGE_KEY = "expense-log-store-v1";

function template(
  id: string,
  name: string,
  dueDay: number,
  amount: number,
  startDate = `2026-06-${String(dueDay).padStart(2, "0")}`,
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
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function paid(
  templateId: string,
  occurrenceDate: string,
  amountPaid?: number,
): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    amountPaid,
    updatedAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

// Solo la primera vez: una recarga debe ver lo guardado por la app.
async function seed(page: Page, store: ExpenseStore) {
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

async function storedFinance(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}").finance, STORAGE_KEY);
}

function expenseRow(page: Page, name: string) {
  return page.locator('[data-expense-row="true"]').filter({ hasText: name }).first();
}

test("pays a variable bill with another amount and updates the series from now on", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    // El gimnasio sigue pendiente: pagar la luz no deja el mes al día.
    templates: [template("luz", "Luz", 8, 60), template("gym", "Gimnasio", 30, 35)],
    overrides: [paid("luz", "2026-08-08", 70), paid("luz", "2026-09-08", 74)],
  });
  await page.goto("/");

  const row = expenseRow(page, "Luz");
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Luz" });
  await sheet.getByRole("button", { name: "Pagado con otro importe" }).click();

  const suggestion = sheet.getByRole("button", { name: /Media de los 2 últimos: 72,00/ });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(sheet.getByLabel("Importe cobrado")).toHaveValue("72");
  await sheet.getByLabel("Importe cobrado").fill("74,30");
  await sheet.getByRole("button", { name: "Guardar pago" }).click();

  await expect(
    sheet.getByRole("heading", { name: "¿Actualizar el importe desde ahora?" }),
  ).toBeVisible();
  await expect(sheet.getByText(/pasarán de 60,00\s*€ a 74,30\s*€/)).toBeVisible();
  await sheet.getByRole("button", { name: "Actualizar" }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: /Luz pasa a 74,30/ })).toBeVisible();
  await expect(expenseRow(page, "Luz")).toContainText(/74,30/);
  await expect(expenseRow(page, "Luz")).toContainText(/previsto 60,00/);

  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(expenseRow(page, "Luz")).toContainText(/74,30/);
});

test("pauses a subscription from its detail and skips those charges", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    templates: [template("gym", "Gimnasio", 5, 35), template("luz", "Luz", 8, 60)],
    overrides: [paid("gym", "2026-10-05")],
  });
  await page.goto("/expenses/gym");

  const card = page.getByRole("region", { name: "Suscripción" });
  await card.getByRole("button", { name: "Pausar" }).click();

  const sheet = page.getByRole("dialog", { name: "Pausar Gimnasio" });
  await expect(
    sheet.getByRole("radiogroup", { name: "Primer cobro que se salta" }).getByRole("radio", {
      name: "5 nov",
    }),
  ).toHaveAttribute("aria-checked", "true");
  await sheet
    .getByRole("radiogroup", { name: "¿Cuándo vuelve?" })
    .getByRole("radio", { name: "Vuelve el 5 ene 2027" })
    .click();
  await expect(sheet.getByText("Se saltan 2 cobros.")).toBeVisible();
  await sheet.getByRole("button", { name: "Pausar", exact: true }).click();

  await expect(sheet).toHaveCount(0);
  await expect(card).toContainText(
    "Pausa programada desde el cobro del 5 nov · vuelve el 5 ene 2027.",
  );
  await expect(card.getByRole("button", { name: "Quitar pausa" })).toBeVisible();

  await page.getByRole("link", { name: "Gastos" }).click();
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(expenseRow(page, "Luz")).toBeVisible();
  await expect(
    page.locator('[data-expense-row="true"]').filter({ hasText: "Gimnasio" }),
  ).toHaveCount(0);
});

test("finishes a subscription after a chosen charge and reactivates it", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    templates: [template("gym", "Gimnasio", 5, 35)],
    overrides: [paid("gym", "2026-10-05")],
  });
  await page.goto("/expenses/gym");

  const card = page.getByRole("region", { name: "Suscripción" });
  await card.getByRole("button", { name: "Finalizar" }).click();

  const sheet = page.getByRole("dialog", { name: "Finalizar Gimnasio" });
  const lastCharge = sheet.getByRole("radiogroup", { name: "Último cobro" });
  // Nunca antes de un cobro pagado: el primero que se ofrece es el de octubre.
  await expect(lastCharge.getByRole("radio").first()).toContainText("5 oct");
  await expect(lastCharge.getByRole("radio", { name: "5 nov" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await lastCharge.getByRole("radio", { name: "5 dic" }).click();
  await sheet.getByRole("button", { name: "Finalizar tras ese cobro" }).click();

  await expect(card).toContainText("Termina tras el cobro del 5 dic.");
  await card.getByRole("button", { name: "Reactivar" }).click();
  await expect(card.getByRole("button", { name: "Finalizar" })).toBeVisible();
});

test("schedules a price change and lists it in the price history", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    templates: [template("spotify", "Spotify", 12, 10.99)],
  });
  await page.goto("/expenses/spotify");

  const price = page.getByRole("region", { name: "Precio" });
  await expect(price).toContainText(/Ahora 10,99/);
  await price.getByRole("button", { name: "Programar cambio de precio" }).click();

  const sheet = page.getByRole("dialog", { name: "Cambio de precio · Spotify" });
  await sheet.getByRole("radiogroup", { name: "Desde" }).getByRole("radio", { name: "mar 2027" }).click();
  await sheet.getByLabel("Nuevo importe").fill("12,99");
  await sheet.getByRole("button", { name: "Programar" }).click();

  await expect(sheet).toHaveCount(0);
  await expect(price).toContainText("Desde mar 2027");
  await expect(price).toContainText(/12,99/);
  await expect(price).toContainText("Programado");

  await price.getByRole("button", { name: "Quitar el cambio de precio de mar 2027" }).click();
  await expect(price).not.toContainText("Programado");
});

test("asks '¿Has cobrado?' on payday and edits one month salary only", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await seed(page, {
    ...emptyStore,
    templates: [template("gym", "Gimnasio", 30, 35)],
    finance: {
      ...emptyStore.finance,
      monthlySalary: {
        "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    },
  });
  await page.goto("/");

  const prompt = page.getByRole("region", { name: "¿Has cobrado la nómina de octubre?" });
  await expect(prompt).toContainText(/Previsto: 2\.?000,00/);
  await prompt.getByRole("button", { name: "Aún no" }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(prompt).toHaveCount(0);

  // Al día siguiente vuelve a preguntar.
  await page.clock.setFixedTime(new Date("2026-10-29T10:00:00"));
  await page.reload();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Otro importe" }).click();
  await prompt.getByLabel("Importe cobrado").fill("2150");
  await prompt.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nómina de octubre cobrada" })).toBeVisible();
  await expect(prompt).toHaveCount(0);

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByText(/cobrado 2\.?150,00/)).toBeVisible();

  // M16: un sueldo distinto en noviembre no cambia diciembre.
  await page.getByRole("combobox", { name: "Mes", exact: true }).selectOption({
    label: "noviembre 2026",
  });
  await page.getByRole("button", { name: "Editar ingreso fijo" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar sueldo del mes" });
  const scope = dialog.getByRole("radiogroup", { name: "¿A qué meses afecta?" });
  await expect(scope.getByRole("radio", { name: "Desde este mes" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await scope.getByRole("radio", { name: "Solo este mes" }).click();
  await dialog.getByLabel("Sueldo").fill("4000");
  await dialog.getByRole("button", { name: "Guardar sueldo" }).click();
  await expect(dialog).toHaveCount(0);

  const finance = await storedFinance(page);
  expect(finance.monthlySalary["2026-11"]).toMatchObject({ amount: 4000, onlyThisMonth: true });
  expect(finance.monthlySalary["2026-12"]).toBeUndefined();
  expect(finance.salaryReceipts["2026-10"]).toMatchObject({ amount: 2150 });
});

test("sets the extra pay months from the plan settings", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    finance: {
      ...emptyStore.finance,
      monthlySalary: {
        "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    },
  });
  await page.goto("/money");

  await page.getByRole("button", { name: "Configurar" }).click();
  const december = page.getByRole("button", { name: "diciembre", exact: true });
  await december.click();
  await expect(december).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  const finance = await storedFinance(page);
  expect(finance.salaryExtraPays["2026-10"]).toMatchObject({ months: [12] });
});

test("records what was paid from the plan editor and keeps the series", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
  await seed(page, {
    ...emptyStore,
    templates: [template("luz", "Luz", 25, 60), template("gym", "Gimnasio", 30, 35)],
  });
  await page.goto("/money");

  // La fila de "Recibos pendientes" (la revisión del mes repite la lista).
  const row = page.locator(".app-monthly-expense-row").filter({ hasText: "Luz" }).first();
  await row.getByRole("button", { name: "Editar" }).click();
  const editor = page.locator('[data-editing="true"]');
  await editor.getByRole("button", { name: "Pagado" }).click();
  await editor.getByLabel("Pagado").fill("71,20");
  await editor.getByRole("button", { name: "Guardar cambios" }).click();

  const question = page.getByRole("dialog", { name: "¿Actualizar el importe desde ahora?" });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Solo este cobro" }).click();
  await expect(question).toHaveCount(0);

  const store = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), STORAGE_KEY);
  expect(store.templates.find((item: ExpenseTemplate) => item.id === "luz").amount).toBe(60);
  expect(
    store.overrides.find((item: ExpenseOccurrenceOverride) => item.templateId === "luz"),
  ).toMatchObject({ status: "paid", amount: 60, amountPaid: 71.2 });
});
