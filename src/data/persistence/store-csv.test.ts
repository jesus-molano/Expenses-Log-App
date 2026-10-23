import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import { summarizeStore } from "@/domain/store-summary";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { CSV_BOM, parseCsv } from "@/shared/csv";
import { BackupFileError } from "./backup-errors";
import { CSV_COLUMNS, csvToStore, storeToCsv } from "./store-csv";
import { normalizeExpenseStore } from "./store-normalization";

const today = new Date("2026-10-23T10:00:00");

function template(
  id: string,
  name: string,
  amount: number,
  categoryId: string,
  startDate: string,
  extra: Partial<ExpenseTemplate> = {},
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
    dueDay: Number(startDate.slice(8, 10)),
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...extra,
  };
}

function paid(templateId: string, occurrenceDate: string, amountPaid: number) {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid" as const,
    paidAt: `${occurrenceDate}T12:00:00.000Z`,
    amountPaid,
    updatedAt: `${occurrenceDate}T12:00:00.000Z`,
    statusUpdatedAt: `${occurrenceDate}T12:00:00.000Z`,
  };
}

const store: ExpenseStore = normalizeExpenseStore(
  {
    ...emptyStore,
    categories: [
      { id: "cat-home", userId: "demo", name: "Casa", icon: "Home", tone: "green" },
      { id: "cat-food", userId: "demo", name: "Alimentacion", icon: "Utensils", tone: "orange" },
      { id: "cat-subs", userId: "demo", name: "Suscripciones", icon: "Sparkles", tone: "violet" },
    ],
    templates: [
      template("rent", "Alquiler", 700, "cat-home", "2026-08-01"),
      template("netflix", "Netflix", 12.99, "cat-subs", "2026-09-05", {
        reminder: { enabled: true, daysBeforeCharge: 3 },
      }),
      template("insurance", "Seguro, \"todo riesgo\"", 420, "cat-home", "2026-03-10", {
        recurrence: { frequency: "yearly", annualMonth: 3 },
      }),
      template("market", "=Compra", 60, "cat-food", "2026-10-02", {
        recurrence: { frequency: "custom", interval: 2, unit: "week" },
        description: "Mercado\ncon salto",
      }),
    ],
    overrides: [
      paid("rent", "2026-10-01", 700),
      paid("rent", "2026-11-01", 700),
      {
        id: "ovr:netflix:2026-10-05",
        userId: "demo",
        templateId: "netflix",
        occurrenceDate: "2026-10-05",
        dueDate: "2026-10-07",
        status: "due",
        updatedAt: "2026-10-04T09:00:00.000Z",
      },
    ],
    occurrenceRecords: [
      {
        id: "record:gym-old:2026-08-12",
        userId: "demo",
        templateId: "gym-old",
        occurrenceDate: "2026-08-12",
        monthId: "2026-08",
        dueDate: "2026-08-12",
        name: "Gimnasio antiguo",
        description: "",
        plannedAmount: 35,
        currency: "EUR",
        categoryId: "cat-sport",
        categoryName: "Deporte",
        status: "paid",
        sortOrder: 0,
        paidAt: "2026-08-12T08:00:00.000Z",
        amountPaid: 35,
        source: "native",
        createdAt: "2026-08-12T08:00:00.000Z",
        updatedAt: "2026-08-12T08:00:00.000Z",
      },
    ],
  },
  today,
);

function rowsOf(csv: string) {
  const [header, ...rows] = parseCsv(csv);
  return rows.map((cells) =>
    Object.fromEntries(header.map((column, index) => [column, cells[index]])),
  );
}

describe("storeToCsv", () => {
  it("writes one header, the series and their history with stable values", () => {
    const csv = storeToCsv(store, { today, language: "es" });
    const rows = rowsOf(csv);

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(parseCsv(csv)[0]).toEqual([...CSV_COLUMNS]);
    expect(rows.filter((row) => row.type === "expense")).toHaveLength(4);
    expect(rows.find((row) => row.expense_id === "rent" && row.type === "expense")).toMatchObject({
      name: "Alquiler",
      category: "Casa",
      amount: "700.00",
      frequency: "monthly",
      due_day: "1",
      start_date: "2026-08-01",
    });
    expect(
      rows.find((row) => row.expense_id === "netflix" && row.type === "expense")?.reminder_days,
    ).toBe("3");
  });

  it("shows category labels with accents in the chosen language", () => {
    const spanish = rowsOf(storeToCsv(store, { today, language: "es" }));
    const english = rowsOf(storeToCsv(store, { today, language: "en" }));

    expect(spanish.find((row) => row.expense_id === "market")?.category).toBe("Alimentación");
    expect(english.find((row) => row.expense_id === "market")?.category).toBe("Food");
  });

  it("includes closed months, deleted expenses and later payments made in advance", () => {
    const occurrences = rowsOf(storeToCsv(store, { today })).filter(
      (row) => row.type === "occurrence",
    );
    const keys = occurrences.map((row) => `${row.expense_id}:${row.occurrence_date}`);

    expect(keys).toEqual(
      expect.arrayContaining([
        "rent:2026-08-01",
        "rent:2026-09-01",
        "rent:2026-10-01",
        "rent:2026-11-01",
        "gym-old:2026-08-12",
        "netflix:2026-10-05",
      ]),
    );
    // Lo futuro sin cambios no es histórico.
    expect(keys).not.toContain("netflix:2026-11-05");
    expect(occurrences.find((row) => row.expense_id === "netflix" && row.occurrence_date === "2026-10-05"))
      .toMatchObject({ due_date: "2026-10-07", status: "due" });
    expect(occurrences.find((row) => row.expense_id === "gym-old")).toMatchObject({
      status: "paid",
      amount_paid: "35.00",
      category: "Deporte",
    });
  });

  it("protects text that a spreadsheet would run as a formula", () => {
    const market = rowsOf(storeToCsv(store, { today })).find(
      (row) => row.expense_id === "market" && row.type === "expense",
    );
    expect(market?.name).toBe("'=Compra");
  });
});

describe("csvToStore", () => {
  it("round-trips an export without losing series, payments or history", () => {
    const { store: imported, skippedRows } = csvToStore(storeToCsv(store, { today }), {
      now: today,
    });

    expect(skippedRows).toBe(0);
    expect(summarizeStore(imported)).toEqual(summarizeStore(store));
    for (const original of store.templates) {
      expect(imported.templates.find((item) => item.id === original.id)).toMatchObject({
        name: original.name,
        description: original.description,
        amount: original.amount,
        startDate: original.startDate,
        dueDay: original.dueDay,
        recurrence: original.recurrence,
        ...(original.reminder ? { reminder: original.reminder } : {}),
        active: true,
      });
      expect(Boolean(imported.templates.find((item) => item.id === original.id)?.reminder)).toBe(
        Boolean(original.reminder),
      );
    }
    expect(imported.overrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ templateId: "rent", occurrenceDate: "2026-10-01", status: "paid", amountPaid: 700 }),
        expect.objectContaining({ templateId: "rent", occurrenceDate: "2026-11-01", status: "paid" }),
        expect.objectContaining({ templateId: "netflix", occurrenceDate: "2026-10-05", dueDate: "2026-10-07" }),
      ]),
    );
    expect(imported.occurrenceRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "record:gym-old:2026-08-12", status: "paid", amountPaid: 35, categoryName: "Deporte" }),
        expect.objectContaining({ id: "record:rent:2026-09-01", status: "due", plannedAmount: 700 }),
      ]),
    );
  });

  it("keeps an expense's own reminder apart from the default one", () => {
    const withReminders = normalizeExpenseStore(
      {
        ...emptyStore,
        templates: [
          template("light", "Luz", 40, "cat-home", "2026-10-03"),
          template("water", "Agua", 20, "cat-home", "2026-10-04", {
            reminder: { enabled: false, daysBeforeCharge: 3 },
          }),
          template("gas", "Gas", 30, "cat-home", "2026-10-05", {
            reminder: { enabled: true, daysBeforeCharge: 5 },
          }),
        ],
      },
      today,
    );
    const csv = storeToCsv(withReminders, { today });

    // Vacío sigue el aviso por defecto de Ajustes; "off" es un aviso propio
    // apagado, que no avisa aunque el de Ajustes esté encendido.
    expect(
      rowsOf(csv)
        .filter((row) => row.type === "expense")
        .map((row) => row.reminder_days),
    ).toEqual(["", "off", "5"]);
    const { store: imported } = csvToStore(csv, { now: today });
    const reminderOf = (id: string) =>
      imported.templates.find((item) => item.id === id)?.reminder;
    expect(reminderOf("light")).toBeUndefined();
    expect(reminderOf("water")).toEqual({ enabled: false, daysBeforeCharge: 3 });
    expect(reminderOf("gas")).toEqual({ enabled: true, daysBeforeCharge: 5 });
  });

  it("reuses the categories that already exist with the same name", () => {
    const { store: imported } = csvToStore(storeToCsv(store, { today, language: "en" }), {
      now: today,
      current: store,
    });
    const rent = imported.templates.find((item) => item.id === "rent");
    const market = imported.templates.find((item) => item.id === "market");

    expect(rent?.categoryId).toBe("cat-home");
    expect(market?.categoryId).toBe("cat-food");
  });

  it("imports a hand-made spreadsheet saved by Excel in Spanish", () => {
    const csv = [
      "Name;Amount;Frequency;Due day;Category",
      "Luz;64,75;monthly;8;Servicios",
      'Seguro coche;"1.200,50";yearly;10;Vehículo',
      ";12;monthly;1;",
      "Gimnasio;abc;monthly;1;Deporte",
    ].join("\r\n");
    const { store: imported, skippedRows } = csvToStore(csv, { now: today });

    expect(skippedRows).toBe(2);
    expect(imported.templates).toHaveLength(2);
    const [light, insurance] = imported.templates;
    expect(light).toMatchObject({ name: "Luz", amount: 64.75, dueDay: 8 });
    expect(insurance).toMatchObject({
      name: "Seguro coche",
      amount: 1200.5,
      recurrence: { frequency: "yearly", annualMonth: 10 },
    });
    const names = new Map(imported.categories.map((category) => [category.id, category.name]));
    expect(names.get(light.categoryId)).toBe("Servicios");
    expect(names.get(insurance.categoryId)).toBe("Vehiculo");
  });

  it("adds payments for expenses that already exist on this device", () => {
    const csv = [
      "type,expense_id,name,amount,occurrence_date,due_date,status,amount_paid",
      "occurrence,rent,Alquiler,700.00,2026-10-01,2026-10-01,paid,700.00",
      "occurrence,unknown,Otro,10.00,2026-10-03,2026-10-03,paid,10.00",
      "note,rent,Alquiler,700.00,,,,",
    ].join("\n");
    const { store: imported, skippedRows } = csvToStore(csv, { now: today, current: store });

    expect(skippedRows).toBe(2);
    expect(imported.overrides).toEqual([
      expect.objectContaining({ id: "ovr:rent:2026-10-01", status: "paid", amountPaid: 700 }),
    ]);
  });

  it("rejects files without the minimum columns or any usable row", () => {
    const errorCode = (text: string) => {
      try {
        csvToStore(text, { now: today });
        return null;
      } catch (error) {
        return error instanceof BackupFileError ? error.code : "other";
      }
    };

    expect(errorCode("")).toBe("empty");
    expect(errorCode("name,price\nLuz,10")).toBe("csv-columns");
    expect(errorCode("name,amount\n,\nLuz,0")).toBe("csv-no-rows");
  });
});
