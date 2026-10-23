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
    paidAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
  };
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

// Octubre pagado entero y el alquiler de noviembre ya pagado por adelantado.
const settledOctober: ExpenseStore = {
  ...emptyStore,
  templates: [template("rent", "Alquiler", 1, 700), template("gym", "Gimnasio", 12, 30)],
  overrides: [
    paid("rent", "2026-09-01"),
    paid("gym", "2026-09-12"),
    paid("rent", "2026-10-01"),
    paid("gym", "2026-10-12"),
    paid("rent", "2026-11-01"),
  ],
};

test("offers to move to next month once the current one is settled, with undo", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await page.addInitScript(
    ({ key, store }) => {
      // Solo la primera vez: una recarga debe ver lo guardado por la app.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, store: settledOctober },
  );
  await page.goto("/");

  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(page.getByText("Octubre al día")).toBeVisible();
  await expect(page.getByText("2 pagados · 1 de noviembre ya pagado")).toBeVisible();

  await page.getByRole("button", { name: "Pasar a noviembre" }).click();

  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await expect(page.getByText("30,00 €").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Noviembre activo" })).toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();

  await page.getByRole("button", { name: "Pasar a noviembre" }).click();
  await page.reload();
  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await page.getByRole("button", { name: "Volver a octubre" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
});

test("browses months without changing the active one", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await page.addInitScript(
    ({ key, store }) => {
      // Solo la primera vez: una recarga debe ver lo guardado por la app.
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, store: settledOctober },
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByText("Por pagar · septiembre")).toBeVisible();
  await page.getByRole("button", { name: "Ir a octubre" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
});

test("moving on from the settle toast keeps the payment that settled the month", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  const lastPending: ExpenseStore = {
    ...settledOctober,
    overrides: settledOctober.overrides.filter(
      (override) => override.id !== "ovr:gym:2026-10-12",
    ),
  };
  await page.addInitScript(
    ({ key, store }) => {
      if (window.localStorage.getItem("e2e-seeded")) return;
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem("e2e-seeded", "1");
    },
    { key: STORAGE_KEY, store: lastPending },
  );
  await page.goto("/");

  await expect(page.getByText("Octubre al día")).toHaveCount(0);
  await swipeToPay(page, "Gimnasio");

  const toast = page.getByRole("status").filter({ hasText: "Octubre al día" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Pasar a noviembre" }).click();

  await expect(page.getByText("Por pagar · noviembre")).toBeVisible();
  await page.getByRole("button", { name: "Volver a octubre" }).click();
  await expect(page.getByText("Por pagar · octubre")).toBeVisible();
  await expect(page.getByText("0,00 €").first()).toBeVisible();
});
