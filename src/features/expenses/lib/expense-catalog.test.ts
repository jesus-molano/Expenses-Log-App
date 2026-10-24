import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  DEFAULT_CATALOG_FILTERS,
  buildExpenseCatalog,
  catalogCategoryIds,
  countEndingCommitments,
  filterCatalog,
  hasActiveCatalogFilters,
  summarizeCatalog,
} from "./expense-catalog";

const TODAY = "2026-10-23";

function template(
  id: string,
  overrides: Partial<ExpenseTemplate> = {},
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 10,
    currency: "EUR",
    categoryId: "casa",
    startDate: "2026-01-01",
    dueDay: 5,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("Netflix", {
      amount: 12.99,
      dueDay: 28,
      categoryId: "subs",
      notes: "Plan estándar compartido",
      commitmentEndDate: "2026-11-10",
    }),
    template("Luz", { amount: 60, dueDay: 8 }),
    template("Seguro coche", {
      amount: 420,
      recurrence: { frequency: "yearly", annualMonth: 3 },
      dueDay: 15,
      categoryId: "coche",
    }),
    template("Gimnasio", { amount: 35, dueDay: 1, endDate: "2026-09-30", categoryId: "deporte" }),
    template("Sofá", {
      amount: 300,
      recurrence: { frequency: "once" },
      startDate: "2026-10-02",
      dueDay: 2,
    }),
    template("Cada dos semanas", {
      amount: 5,
      recurrence: { frequency: "custom", interval: 2, unit: "week" },
      startDate: "2026-10-26",
      dueDay: 26,
    }),
  ],
  overrides: [
    // La luz de octubre sigue pendiente (vencía el 8): atrasada.
    // El sofá se pagó: terminado.
    {
      id: "ovr:Sofá:2026-10-02",
      userId: "demo",
      templateId: "Sofá",
      occurrenceDate: "2026-10-02",
      status: "paid",
    },
    // El Netflix de octubre se salta: el próximo es el de noviembre.
    {
      id: "ovr:Netflix:2026-10-28",
      userId: "demo",
      templateId: "Netflix",
      occurrenceDate: "2026-10-28",
      status: "skipped",
    },
  ],
};

const names = (items: ReturnType<typeof buildExpenseCatalog>) =>
  items.map((item) => item.template.name);

describe("expense catalog", () => {
  const items = buildExpenseCatalog({
    store,
    today: TODAY,
    categoryNameOf: (id) => ({ subs: "Suscripciones", coche: "Vehículo" })[id] ?? "",
  });

  it("lists every series: overdue first, then by next charge, finished last", () => {
    // Netflix y Luz tienen cobros sin pagar de septiembre y octubre.
    expect(names(items)).toEqual([
      "Netflix",
      "Luz",
      "Cada dos semanas",
      "Seguro coche",
      "Gimnasio",
      "Sofá",
    ]);
    const byName = Object.fromEntries(items.map((item) => [item.template.name, item]));

    expect(byName.Netflix.overdueOccurrence?.dueDate).toBe("2026-09-28");
    expect(byName.Luz.overdueOccurrence?.dueDate).toBe("2026-10-08");
    expect(byName.Luz.nextOccurrence?.dueDate).toBe("2026-11-08");
    expect(byName.Netflix.nextOccurrence?.dueDate).toBe("2026-11-28");
    expect(byName["Seguro coche"].nextOccurrence?.dueDate).toBe("2027-03-15");
    expect(byName.Gimnasio).toMatchObject({ finished: true, finishedOn: "2026-09-30", nextOccurrence: null });
    expect(byName["Sofá"]).toMatchObject({ finished: true, finishedOn: "2026-10-02" });
  });

  it("adds what each series costs over the next twelve months", () => {
    const byName = Object.fromEntries(items.map((item) => [item.template.name, item]));

    // Netflix: el de octubre (28) está saltado; de noviembre a octubre, 11.
    expect(byName.Netflix.yearlyCost).toBe(142.89);
    expect(byName.Luz.yearlyCost).toBe(720);
    expect(byName["Seguro coche"].yearlyCost).toBe(420);
    expect(byName.Gimnasio.yearlyCost).toBe(0);
    expect(byName["Cada dos semanas"].yearlyCost).toBe(130);
  });

  it("shows the price of the charge that is due, with its price changes", () => {
    const [priced] = buildExpenseCatalog({
      store: {
        ...emptyStore,
        templates: [
          template("Gimnasio", {
            amount: 30,
            dueDay: 15,
            amountChanges: [{ from: "2026-11-01", amount: 35 }],
          }),
        ],
        overrides: [
          {
            id: "ovr:Gimnasio:2026-11-15",
            userId: "demo",
            templateId: "Gimnasio",
            occurrenceDate: "2026-11-15",
            status: "paid",
            amountPaid: 33,
          },
        ],
      },
      today: TODAY,
    });

    // El de octubre (15) se pasó sin pagar: aún cuesta 30.
    expect(priced.amount).toBe(30);
    // Noviembre se pagó por adelantado con 33; los once siguientes, a 35.
    expect(priced.yearlyCost).toBe(418);
  });

  it("searches name, notes and category without accents and filters by status and frequency", () => {
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, query: "estandar" }))).toEqual([
      "Netflix",
    ]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, query: "vehiculo" }))).toEqual([
      "Seguro coche",
    ]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, query: "sofa" }))).toEqual([]);
    expect(
      names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, query: "sofa", status: "all" })),
    ).toEqual(["Sofá"]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, status: "finished" }))).toEqual([
      "Gimnasio",
      "Sofá",
    ]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, frequency: "yearly" }))).toEqual([
      "Seguro coche",
    ]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, frequency: "other" }))).toEqual([
      "Cada dos semanas",
    ]);
    expect(names(filterCatalog(items, { ...DEFAULT_CATALOG_FILTERS, categoryId: "subs" }))).toEqual([
      "Netflix",
    ]);
  });

  it("summarises the active series and knows when filters are applied", () => {
    expect(summarizeCatalog(items)).toEqual({
      activeCount: 4,
      yearlyTotal: 1412.89,
      monthlyAverage: 117.74,
    });
    expect(hasActiveCatalogFilters(DEFAULT_CATALOG_FILTERS)).toBe(false);
    expect(hasActiveCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, query: " " })).toBe(false);
    expect(hasActiveCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, status: "all" })).toBe(true);
    expect(catalogCategoryIds(items).sort()).toEqual(["casa", "coche", "deporte", "subs"]);
  });

  it("counts commitments that end within the hint window", () => {
    expect(countEndingCommitments(items)).toBe(1);
  });
});
