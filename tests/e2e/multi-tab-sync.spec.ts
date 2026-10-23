import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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
    paidAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
  };
}

// Solo falta el gimnasio de octubre; el alquiler de noviembre ya está pagado.
const gymPending: ExpenseStore = {
  ...emptyStore,
  templates: [template("rent", "Alquiler", 1, 700), template("gym", "Gimnasio", 12, 30)],
  overrides: [
    paid("rent", "2026-09-01"),
    paid("gym", "2026-09-12"),
    paid("rent", "2026-10-01"),
    paid("rent", "2026-11-01"),
  ],
};

async function seed(context: BrowserContext, store: ExpenseStore) {
  await context.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await context.addInitScript(
    ({ key, store }) => {
      // Solo la primera pestaña siembra: la segunda debe ver lo guardado.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, store },
  );
}

async function openTab(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  // Marca que solo sobrevive si la pestaña no se recarga.
  await page.evaluate(() => {
    (window as unknown as { e2eNoReload: boolean }).e2eNoReload = true;
  });
  return page;
}

async function swipeToPay(page: Page, name: string) {
  const row = page.locator('[data-expense-row="true"]').filter({ hasText: name }).first();
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  const startX = Math.min(box!.x + box!.width - 12, 354);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 240, y, { steps: 10 });
  await page.mouse.up();
}

async function storedOverrideIds(page: Page) {
  return page.evaluate((key) => {
    const store = JSON.parse(window.localStorage.getItem(key) ?? "{}") as ExpenseStore;
    return store.overrides
      .filter((override) => override.status === "paid")
      .map((override) => override.id)
      .sort();
  }, STORAGE_KEY);
}

test("a payment made in one tab shows up in the other without reloading", async ({
  context,
}) => {
  await seed(context, gymPending);
  const phone = await openTab(context);
  const other = await openTab(context);
  await expect(other.getByText("30,00 €").first()).toBeVisible();

  await swipeToPay(phone, "Gimnasio");
  await expect(phone.getByRole("status").filter({ hasText: "Octubre al día" })).toBeVisible();

  // La otra pestaña se entera por el evento `storage`, sin recargar.
  await expect(other.getByText("Octubre al día").first()).toBeVisible();
  await expect(other.getByText("0,00 €").first()).toBeVisible();
  expect(
    await other.evaluate(() => (window as unknown as { e2eNoReload?: boolean }).e2eNoReload),
  ).toBe(true);
});

test("edits made in two tabs are both kept", async ({ context }) => {
  await seed(context, gymPending);
  const first = await openTab(context);
  const second = await openTab(context);

  await swipeToPay(first, "Gimnasio");
  await expect(second.getByText("Octubre al día").first()).toBeVisible();

  // La segunda pestaña paga el gimnasio de noviembre sobre lo que ya trajo.
  await second.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(second.getByText("Por pagar · noviembre")).toBeVisible();
  await swipeToPay(second, "Gimnasio");
  await expect(second.getByText("0,00 €").first()).toBeVisible();

  const expected = [
    "ovr:gym:2026-09-12",
    "ovr:gym:2026-10-12",
    "ovr:gym:2026-11-12",
    "ovr:rent:2026-09-01",
    "ovr:rent:2026-10-01",
    "ovr:rent:2026-11-01",
  ];
  expect(await storedOverrideIds(second)).toEqual(expected);

  // La primera ve el pago de noviembre y ninguna recarga pierde nada.
  await first.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(first.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(first.getByText("0,00 €").first()).toBeVisible();
  await first.reload();
  expect(await storedOverrideIds(first)).toEqual(expected);
});
