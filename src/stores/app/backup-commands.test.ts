import { describe, expect, it } from "vitest";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import { getSalaryExtraPay } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseTemplate,
  IncomeEvent,
} from "@/domain/types";
import { importStoreInStore, replaceStoreContents } from "./backup-commands";

const now = new Date("2026-10-23T10:00:00.000Z");
const stamp = now.toISOString();

function template(
  id: string,
  amount: number,
  updatedAt: string,
  categoryId = "cat-home",
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount,
    currency: "EUR",
    categoryId,
    startDate: "2026-08-01",
    dueDay: 1,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt,
  };
}

function paid(
  templateId: string,
  occurrenceDate: string,
  amountPaid: number,
  updatedAt: string,
): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid",
    paidAt: updatedAt,
    amountPaid,
    updatedAt,
    statusUpdatedAt: updatedAt,
  };
}

function income(id: string, updatedAt: string): IncomeEvent {
  return {
    id,
    userId: "demo",
    name: id,
    amount: 40,
    currency: "EUR",
    receivedAt: "2026-10-10",
    createdAt: updatedAt,
    updatedAt,
  };
}

const current = normalizeExpenseStore(
  {
    ...emptyStore,
    categories: [
      { id: "cat-home", userId: "demo", name: "Casa", icon: "Home", tone: "green" },
      { id: "cat-old", userId: "demo", name: "Ocio", icon: "Gamepad2", tone: "violet" },
    ],
    templates: [
      template("rent", 700, "2026-10-01T00:00:00.000Z"),
      template("gym", 30, "2026-08-01T00:00:00.000Z", "cat-old"),
    ],
    overrides: [
      paid("rent", "2026-09-01", 700, "2026-09-01T09:00:00.000Z"),
      paid("rent", "2026-10-01", 700, "2026-10-02T09:00:00.000Z"),
      paid("gym", "2026-10-01", 30, "2026-10-02T09:00:00.000Z"),
    ],
    finance: {
      ...emptyStore.finance,
      incomeEvents: [income("evt-a", "2026-10-10T00:00:00.000Z")],
      monthlySalary: {
        "2026-09": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-09-01T00:00:00.000Z" },
        "2026-10": { amount: 2200, dayOfMonth: 28, updatedAt: "2026-10-01T00:00:00.000Z" },
      },
      monthlySavingsTargets: {
        "2026-10": { amount: 300, updatedAt: "2026-10-01T00:00:00.000Z" },
      },
      monthClosures: {
        "2026-09": { closedAt: "2026-09-30T20:00:00.000Z", updatedAt: "2026-09-30T20:00:00.000Z" },
      },
    },
    deleted: { templates: ["deleted-long-ago"] },
    preferences: { theme: "nord", language: "en" },
  },
  now,
);

// Copia más antigua: el alquiler costaba 650, no había gimnasio y sí Netflix.
const imported = normalizeExpenseStore(
  {
    ...emptyStore,
    categories: [{ id: "cat-home", userId: "demo", name: "Casa", icon: "Home", tone: "green" }],
    templates: [
      template("rent", 650, "2026-09-01T00:00:00.000Z"),
      template("netflix", 12.99, "2026-09-01T00:00:00.000Z"),
    ],
    overrides: [
      paid("rent", "2026-09-01", 650, "2026-09-01T09:00:00.000Z"),
      paid("netflix", "2026-10-01", 12.99, "2026-10-01T09:00:00.000Z"),
    ],
    finance: {
      ...emptyStore.finance,
      incomeEvents: [income("evt-b", "2026-09-10T00:00:00.000Z")],
      monthlySalary: {
        "2026-09": { amount: 1900, dayOfMonth: 25, updatedAt: "2026-09-01T00:00:00.000Z" },
      },
    },
    preferences: { theme: "atlas", language: "es" },
  },
  now,
);

const byId = <T extends { id: string }>(items: T[], id: string) =>
  items.find((item) => item.id === id);

describe("importStoreInStore — merge", () => {
  it("keeps the newest version of each item and the device preferences", () => {
    const merged = importStoreInStore(current, imported, { mode: "merge", scope: "all", now });

    expect(merged.templates.map((item) => item.id).sort()).toEqual(["gym", "netflix", "rent"]);
    expect(byId(merged.templates, "rent")?.amount).toBe(700);
    expect(merged.finance.incomeEvents.map((event) => event.id).sort()).toEqual(["evt-a", "evt-b"]);
    expect(merged.preferences).toEqual({ theme: "nord", language: "en" });
    expect(merged.deleted?.templates).toContain("deleted-long-ago");
  });

  it("leaves Plan and income alone when the file only has expenses", () => {
    const merged = importStoreInStore(current, imported, {
      mode: "merge",
      scope: "expenses",
      now,
    });

    expect(merged.finance.incomeEvents.map((event) => event.id)).toEqual(["evt-a"]);
    expect(merged.finance.monthlySalary["2026-09"].amount).toBe(2000);
  });
});

describe("replaceStoreContents", () => {
  const replaced = replaceStoreContents(current, imported, { scope: "all", now });

  it("leaves exactly the imported data, marked as edited now", () => {
    expect(replaced.templates.map((item) => item.id).sort()).toEqual(["netflix", "rent"]);
    expect(byId(replaced.templates, "rent")).toMatchObject({ amount: 650, updatedAt: stamp });
    expect(replaced.categories.map((category) => category.id)).toEqual(["cat-home"]);
    expect(replaced.finance.incomeEvents).toEqual([
      expect.objectContaining({ id: "evt-b", updatedAt: stamp }),
    ]);
    expect(Object.keys(replaced.finance.monthlySalary)).toEqual(["2026-09"]);
    expect(replaced.finance.monthlySalary["2026-09"]).toMatchObject({ amount: 1900, updatedAt: stamp });
    expect(replaced.preferences).toEqual({ theme: "nord", language: "en" });
  });

  it("tombstones random ids and neutralises deterministic ones", () => {
    expect(replaced.deleted?.templates).toEqual(
      expect.arrayContaining(["gym", "deleted-long-ago"]),
    );
    expect(replaced.deleted?.templates).not.toContain("rent");
    expect(replaced.deleted?.categories).toContain("cat-old");
    expect(replaced.deleted?.incomeEvents).toContain("evt-a");
    expect(replaced.deleted?.overrides).toContain("ovr:gym:2026-10-01");
    expect(replaced.deleted?.monthlySalary).toContain(`2026-10@${stamp}`);
    // El cobro de octubre del alquiler no está en la copia: vuelve a pendiente
    // con un cambio nuevo en lugar de borrarse.
    expect(byId(replaced.overrides, "ovr:rent:2026-10-01")).toMatchObject({
      status: "due",
      updatedAt: stamp,
      statusUpdatedAt: stamp,
    });
    expect(byId(replaced.overrides, "ovr:rent:2026-09-01")).toMatchObject({
      status: "paid",
      amountPaid: 650,
    });
    expect(replaced.finance.monthClosures?.["2026-09"]).toMatchObject({
      reopenedAt: stamp,
      updatedAt: stamp,
    });
  });

  it("rebuilds the closed-month history from the imported data", () => {
    expect(byId(replaced.occurrenceRecords ?? [], "record:rent:2026-09-01")).toMatchObject({
      status: "paid",
      plannedAmount: 650,
      amountPaid: 650,
      updatedAt: stamp,
    });
    expect(byId(replaced.occurrenceRecords ?? [], "record:gym:2026-09-01")).toBeUndefined();
    expect(replaced.deleted?.occurrenceRecords).toContain("record:gym:2026-09-01");
  });

  it("survives a later merge with the old data in either direction", () => {
    for (const merged of [
      mergeExpenseStores(replaced, current),
      mergeExpenseStores(current, replaced),
    ]) {
      expect(merged.templates.map((item) => item.id).sort()).toEqual(["netflix", "rent"]);
      expect(byId(merged.templates, "rent")?.amount).toBe(650);
      expect(byId(merged.overrides, "ovr:rent:2026-10-01")?.status).toBe("due");
      expect(merged.finance.incomeEvents.map((event) => event.id)).toEqual(["evt-b"]);
      expect(Object.keys(merged.finance.monthlySalary)).toEqual(["2026-09"]);
      expect(merged.finance.monthClosures?.["2026-09"]?.reopenedAt).toBe(stamp);
    }
  });

  it("lets a later import bring back an id that a previous replace removed", () => {
    const back = replaceStoreContents(replaced, current, { scope: "all", now: new Date("2026-10-24T10:00:00.000Z") });

    expect(back.templates.map((item) => item.id).sort()).toEqual(["gym", "rent"]);
    expect(back.deleted?.templates).not.toContain("gym");
    expect(back.deleted?.templates).toContain("netflix");
  });

  it("only replaces expenses when the file is a CSV", () => {
    const csvReplace = replaceStoreContents(current, imported, { scope: "expenses", now });

    expect(csvReplace.templates.map((item) => item.id).sort()).toEqual(["netflix", "rent"]);
    expect(csvReplace.finance.incomeEvents.map((event) => event.id)).toEqual(["evt-a"]);
    expect(csvReplace.finance.monthlySalary["2026-10"].amount).toBe(2200);
    expect(csvReplace.finance.monthClosures?.["2026-09"]?.reopenedAt).toBeUndefined();
    expect(csvReplace.deleted?.incomeEvents ?? []).not.toContain("evt-a");
  });

  it("keeps the money data of the file and undoes salary answers it does not bring", () => {
    const withMoney = normalizeExpenseStore(
      {
        ...current,
        templates: [
          { ...template("gym", 30, "2026-08-01T00:00:00.000Z"), pauses: [{ from: "2026-11-01" }] },
        ],
        finance: {
          ...current.finance,
          salaryReceipts: {
            "2026-09": { amount: 2000, receivedOn: "2026-09-28", updatedAt: "2026-09-28T10:00:00.000Z" },
          },
          salaryExtraPays: {
            "2026-01": { months: [6, 12], updatedAt: "2026-01-01T00:00:00.000Z" },
            "2026-06": { months: [12], amount: 900, updatedAt: "2026-06-01T00:00:00.000Z" },
          },
        },
      },
      now,
    );
    const file = normalizeExpenseStore(
      {
        ...imported,
        templates: [
          {
            ...template("rent", 650, "2026-09-01T00:00:00.000Z"),
            amountChanges: [{ from: "2026-12-01", amount: 680 }],
            pauses: [{ from: "2027-02-01", to: "2027-03-31" }],
          },
        ],
        finance: {
          ...imported.finance,
          monthlySalary: {
            "2026-08": {
              amount: 1900,
              dayOfMonth: 25,
              updatedAt: "2026-08-01T00:00:00.000Z",
              onlyThisMonth: true,
            },
          },
          salaryReceipts: {
            "2026-08": { amount: 1950, receivedOn: "2026-08-25", updatedAt: "2026-08-25T10:00:00.000Z" },
          },
          salaryExtraPays: {
            "2026-03": { months: [7], amount: 500, updatedAt: "2026-03-01T00:00:00.000Z" },
          },
        },
      },
      now,
    );
    const result = replaceStoreContents(withMoney, file, { scope: "all", now });

    expect(byId(result.templates, "rent")).toMatchObject({
      amountChanges: [{ from: "2026-12-01", amount: 680 }],
      pauses: [{ from: "2027-02-01", to: "2027-03-31" }],
    });
    expect(result.finance.monthlySalary["2026-08"]).toMatchObject({
      onlyThisMonth: true,
      updatedAt: stamp,
    });
    // Las pagas extra que el archivo no trae pasan a valer lo que el archivo
    // tiene vigente ese mes: nada en enero, la de marzo en junio.
    expect(result.finance.salaryExtraPays).toEqual({
      "2026-01": { months: [], updatedAt: stamp },
      "2026-03": { months: [7], amount: 500, updatedAt: stamp },
      "2026-06": { months: [7], amount: 500, updatedAt: stamp },
    });
    expect(result.finance.salaryReceipts?.["2026-08"]).toMatchObject({
      amount: 1950,
      updatedAt: stamp,
    });
    expect(result.finance.salaryReceipts?.["2026-09"]).toMatchObject({
      undone: true,
      updatedAt: stamp,
    });
    for (const merged of [
      mergeExpenseStores(result, withMoney),
      mergeExpenseStores(withMoney, result),
    ]) {
      expect(merged.finance.salaryReceipts?.["2026-09"]?.undone).toBe(true);
      expect(merged.finance.salaryReceipts?.["2026-08"]?.amount).toBe(1950);
      expect(merged.finance.salaryExtraPays?.["2026-03"]?.amount).toBe(500);
      // Las pagas extra que solo había en este dispositivo no vuelven.
      expect(getSalaryExtraPay(merged.finance, "2026-06")).toBe(0);
      expect(getSalaryExtraPay(merged.finance, "2026-07")).toBe(500);
      expect(getSalaryExtraPay(merged.finance, "2026-12")).toBe(0);
    }
  });

  it("is what the replace mode of importStoreInStore does", () => {
    expect(importStoreInStore(current, imported, { mode: "replace", scope: "all", now })).toEqual(
      replaced,
    );
  });
});

describe("replaceStoreContents — budget cycle and balance log", () => {
  const withInsights = normalizeExpenseStore(
    {
      ...current,
      finance: {
        ...current.finance,
        budgetCycle: { anchor: "payday", updatedAt: "2026-10-05T00:00:00.000Z" },
        balanceCheckins: {
          "2026-10-01": { amount: 1200, updatedAt: "2026-10-01T09:00:00.000Z" },
          "2026-10-15": { amount: 900, updatedAt: "2026-10-15T09:00:00.000Z" },
        },
      },
    },
    now,
  );
  const file = normalizeExpenseStore(
    {
      ...imported,
      finance: {
        ...imported.finance,
        balanceCheckins: {
          "2026-10-01": { amount: 1100, updatedAt: "2026-09-30T09:00:00.000Z" },
        },
      },
    },
    now,
  );
  const replaced = replaceStoreContents(withInsights, file, { scope: "all", now });

  it("keeps the file's balances and cycle, also after a later merge", () => {
    for (const store of [
      replaced,
      mergeExpenseStores(replaced, withInsights),
      mergeExpenseStores(withInsights, replaced),
    ]) {
      // El archivo no trae ciclo: vuelve al mes natural.
      expect(store.finance.budgetCycle).toEqual({ anchor: "calendar", updatedAt: stamp });
      expect(store.finance.balanceCheckins?.["2026-10-01"]).toEqual({
        amount: 1100,
        updatedAt: stamp,
      });
      // El saldo que solo estaba en los datos actuales queda borrado.
      expect(store.finance.balanceCheckins?.["2026-10-15"]?.deletedAt).toBe(stamp);
    }
  });
});
