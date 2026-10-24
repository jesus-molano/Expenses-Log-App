import { expect, test, type Page } from "@playwright/test";
import { emptyStore } from "../../src/domain/seed";
import type {
  ExpenseCategory,
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
  { recurrence = { frequency: "monthly" }, categoryId = "home" }: {
    recurrence?: RecurrenceRule;
    categoryId?: string;
  } = {},
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId,
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function category(id: string, name: string, tone: ExpenseCategory["tone"]): ExpenseCategory {
  return { id, userId: "demo", name, icon: "Home", tone };
}

function paid(templateId: string, occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
  };
}

// Siembra el store solo la primera vez: una recarga debe ver lo guardado.
async function seed(page: Page, store: ExpenseStore, now: string) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ key, store }) => {
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, store },
  );
}

test("anchors the budget month to payday from settings", async ({ page }) => {
  await seed(
    page,
    {
      ...emptyStore,
      templates: [
        template("rent", "Alquiler", 700, "2026-09-01", 1),
        template("internet", "Internet", 30, "2026-09-29", 29),
      ],
      finance: {
        ...emptyStore.finance,
        monthlySalary: {
          "2026-09": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-09-01T00:00:00.000Z" },
        },
      },
    },
    "2026-10-29T10:00:00",
  );

  await page.goto("/");
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Natural", exact: true }).click();
  await page.getByRole("option", { name: /Desde el día de cobro/ }).click();
  await expect(page.getByText("Noviembre: 28 oct – 27 nov")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(page.getByText("28 oct – 27 nov")).toBeVisible();
  // Internet del 29 de octubre y alquiler del 1 de noviembre.
  await expect(page.getByText(/730,00\s€/).first()).toBeVisible();
  // El alquiler de octubre quedó sin pagar en el ciclo anterior.
  await expect(page.getByText("Pendiente de octubre")).toBeVisible();

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Plan de noviembre/ })).toBeVisible();
  await expect(page.getByText("28 oct – 27 nov")).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: "Gastos" }).click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
});

test("shows large upcoming bills, the monthly set-aside and cost by category", async ({
  page,
}) => {
  await seed(
    page,
    {
      ...emptyStore,
      categories: [category("home", "Casa", "green"), category("car", "Vehiculo", "orange")],
      templates: [
        template("rent", "Alquiler", 700, "2026-01-01", 1),
        template("insurance", "Seguro del coche", 300, "2026-03-20", 20, {
          recurrence: { frequency: "yearly", annualMonth: 3 },
          categoryId: "car",
        }),
        template("ibi", "IBI", 150, "2026-01-10", 10, { recurrence: { frequency: "quarterly" } }),
        template("laptop", "Portátil", 900, "2026-12-05", 5, { recurrence: { frequency: "once" } }),
      ],
    },
    "2026-11-02T10:00:00",
  );
  await page.goto("/money");

  const largeBills = page.getByRole("region", { name: "Próximos recibos grandes" });
  await expect(largeBills.getByText(/1\.?050,00\s€ en total/)).toBeVisible();
  await expect(largeBills.getByText("Portátil")).toBeVisible();
  await expect(largeBills.getByText("en 35 días")).toBeVisible();
  // IBI (50 €/mes hasta enero) + seguro (60 €/mes hasta marzo).
  await expect(largeBills.getByText(/Aparta 110,00\s€ al mes/)).toBeVisible();
  await expect(largeBills.getByText(/Media: 75,00\s€\/mes · 900,00\s€\/año/)).toBeVisible();
  await expect(largeBills.getByText(/60,00\s€\/mes hasta entonces/)).toBeVisible();

  const costs = page.getByRole("region", { name: "Coste por categoría" });
  const home = costs.getByRole("button", { name: /Casa/ });
  await home.scrollIntoViewIfNeeded();
  await expect(home).toHaveAttribute("aria-expanded", "false");
  await home.click();
  await expect(home).toHaveAttribute("aria-expanded", "true");
  await expect(costs.getByText("IBI")).toBeVisible();
  await expect(costs.getByText(/600,00\s€\/año/).first()).toBeVisible();
});

test("summarises the month before moving on and from Plan", async ({ page }) => {
  await seed(
    page,
    {
      ...emptyStore,
      templates: [
        template("rent", "Alquiler", 700, "2026-09-01", 1),
        template("gym", "Gimnasio", 30, "2026-09-12", 12),
      ],
      overrides: [
        paid("rent", "2026-09-01"),
        paid("gym", "2026-09-12"),
        paid("rent", "2026-10-01"),
        paid("gym", "2026-10-12"),
        paid("rent", "2026-11-01"),
      ],
    },
    "2026-10-28T10:00:00",
  );
  await page.goto("/");

  await expect(page.getByText("Octubre al día")).toBeVisible();
  await page.getByRole("button", { name: "Ver resumen" }).click();
  const summary = page.getByRole("dialog", { name: "Resumen de octubre" });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("2 de 2 recibos")).toBeVisible();
  await summary.getByRole("button", { name: "Cerrar" }).click();
  await expect(summary).toHaveCount(0);

  await page.getByRole("button", { name: "Pasar a noviembre" }).click();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();

  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("button", { name: /Resumen de octubre/ }).click();
  await expect(page.getByRole("dialog", { name: "Resumen de octubre" })).toBeVisible();
});

test("records an account balance, replaces it and undoes a delete", async ({ page }) => {
  await seed(page, emptyStore, "2026-10-23T10:00:00");
  await page.goto("/money");

  const section = page.getByRole("region", { name: "Cuentas" });
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByText("Aún no has añadido cuentas.")).toBeVisible();

  // La primera cuenta es la de los recibos por defecto.
  await section.getByRole("button", { name: "Añadir cuenta" }).click();
  const editor = page.getByRole("dialog", { name: "Nueva cuenta" });
  await expect(editor.getByRole("radio", { name: /Recibos/ })).toHaveAttribute("aria-checked", "true");
  await editor.getByLabel(/Nombre/).fill("Sabadell");
  await editor.getByRole("button", { name: "Añadir cuenta" }).click();
  await expect(editor).toHaveCount(0);
  const account = section.getByRole("article", { name: "Sabadell" });
  await expect(account.getByText("Aún no has anotado ningún saldo.")).toBeVisible();

  await account.getByRole("button", { name: /Anotar saldo/ }).click();
  const form = page.getByRole("dialog", { name: "Anotar saldo" });
  await expect(form.getByRole("button", { name: "Cuenta: Sabadell" })).toBeVisible();
  await form.getByLabel("Saldo").fill("1250,40");
  await form.getByRole("button", { name: "Guardar saldo" }).click();
  await expect(form).toHaveCount(0);
  await expect(account.getByText(/1\.?250,40\s€/).first()).toBeVisible();

  await account.getByRole("button", { name: /Anotar saldo/ }).click();
  await expect(form.getByText("Ya hay un saldo anotado ese día: se sustituirá.")).toBeVisible();
  await form.getByLabel("Saldo").fill("-35");
  await form.getByRole("button", { name: "Guardar saldo" }).click();
  await expect(account.getByText(/-35,00\s€/).first()).toBeVisible();

  await account.getByRole("button", { name: "Ver historial" }).click();
  await account.getByRole("button", { name: "Borrar el saldo del 23 oct" }).click();
  await expect(account.getByText("Aún no has anotado ningún saldo.")).toBeVisible();
  const toast = page.getByRole("status").filter({ hasText: "Saldo del 23 oct borrado" });
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(account.getByText(/-35,00\s€/).first()).toBeVisible();
});

test("keeps separate accounts and tells whether the bills account covers what is left", async ({
  page,
}) => {
  await seed(
    page,
    {
      ...emptyStore,
      templates: [
        template("rent", "Alquiler", 700, "2026-10-01", 28),
        template("gym", "Gimnasio", 30, "2026-10-01", 26),
      ],
      finance: {
        ...emptyStore.finance,
        monthlySavingsTargets: {
          "2026-10": { amount: 300, updatedAt: "2026-10-01T00:00:00.000Z" },
        },
        // El registro de saldo de antes de las cuentas.
        balanceCheckins: {
          "2026-09-30": { amount: 900, updatedAt: "2026-09-30T10:00:00.000Z" },
        },
      },
    },
    "2026-10-23T10:00:00",
  );
  await page.goto("/money");

  const section = page.getByRole("region", { name: "Cuentas" });
  await section.scrollIntoViewIfNeeded();
  // El saldo migrado es la cuenta de recibos: 900 € frente a los 730 € que
  // quedan por pagar en octubre, con un saldo de septiembre.
  const coverage = section.getByRole("group", { name: "Recibos de octubre" });
  await expect(coverage).toContainText(/te sobran 170,00\s€/);
  await expect(coverage).toContainText(/Es el saldo del 30 sep/);

  await section.getByRole("button", { name: "Editar Cuenta de recibos" }).click();
  const editor = page.getByRole("dialog", { name: "Editar cuenta" });
  await editor.getByLabel(/Nombre/).fill("Sabadell");
  await editor.getByRole("button", { name: "Guardar cuenta" }).click();
  await expect(editor).toHaveCount(0);
  const sabadell = section.getByRole("article", { name: "Sabadell" });
  await expect(sabadell).toBeVisible();

  await section.getByRole("button", { name: "Añadir cuenta" }).click();
  const creator = page.getByRole("dialog", { name: "Nueva cuenta" });
  await creator.getByLabel(/Nombre/).fill("BBVA ahorro");
  await creator.getByRole("radio", { name: /Ahorro/ }).click();
  await creator.getByRole("button", { name: "Añadir cuenta" }).click();
  await expect(creator).toHaveCount(0);
  const savings = section.getByRole("article", { name: "BBVA ahorro" });
  await expect(savings).toContainText(/Objetivo de ahorro de octubre: 300,00\s€/);

  await savings.getByRole("button", { name: /Anotar saldo/ }).click();
  const form = page.getByRole("dialog", { name: "Anotar saldo" });
  await form.getByLabel("Saldo").fill("5000");
  await form.getByRole("button", { name: "Guardar saldo" }).click();
  await expect(form).toHaveCount(0);
  await expect(savings).toContainText(/5\.?000,00\s€/);

  // La misma hoja anota en otra cuenta eligiéndola.
  await savings.getByRole("button", { name: /Anotar saldo/ }).click();
  await form.getByRole("button", { name: "Cuenta: BBVA ahorro" }).click();
  await page.getByRole("option", { name: "Sabadell" }).click();
  await expect(form.getByRole("button", { name: "Cuenta: Sabadell" })).toBeVisible();
  await form.getByLabel("Saldo").fill("600");
  await form.getByRole("button", { name: "Guardar saldo" }).click();
  await expect(form).toHaveCount(0);
  await expect(coverage).toContainText(/te faltan 130,00\s€/);
  await expect(coverage).not.toContainText("puede que ya no esté al día");

  await sabadell.getByRole("button", { name: /Anotar saldo/ }).click();
  await form.getByLabel("Saldo").fill("1000");
  await form.getByRole("button", { name: "Guardar saldo" }).click();
  await expect(coverage).toContainText(
    /Saldo 1\.?000,00\s€ · quedan 730,00\s€ por pagar · te sobran 270,00\s€/,
  );
  // Cada cuenta sigue con su saldo: el ahorro no cuenta para los recibos.
  await expect(savings).toContainText(/5\.?000,00\s€/);

  await page.reload();
  const reloaded = page.getByRole("region", { name: "Cuentas" });
  await expect(reloaded.getByRole("article", { name: "Sabadell" })).toContainText(/1\.?000,00\s€/);
  await expect(reloaded.getByRole("article", { name: "BBVA ahorro" })).toContainText(
    /5\.?000,00\s€/,
  );
});

test("moves a bill due on a bank holiday to the next business day", async ({ page }) => {
  // La serie empieza en octubre: si empezara en septiembre sin pagar ese
  // cobro, "Pendiente de septiembre" iría antes que el cobro del día 12.
  await seed(
    page,
    { ...emptyStore, templates: [template("gym", "Gimnasio", 30, "2026-10-01", 12)] },
    "2026-10-10T10:00:00",
  );
  await page.goto("/");

  // El lunes 12 de octubre es festivo nacional: el banco lo carga el martes.
  const row = page.locator('[data-expense-row="true"]').filter({ hasText: "Gimnasio" }).first();
  await expect(row).toHaveAttribute("data-timeline-date", "2026-10-12");
  await expect(row).toContainText("estimado martes 13");
});
