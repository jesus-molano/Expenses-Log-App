import { describe, expect, it } from "vitest";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
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

  it("keeps the imported name of a category over a dated copy in a later merge", () => {
    const renamedHere = normalizeExpenseStore({
      ...current,
      categories: [
        { id: "cat-home", userId: "demo", name: "Hogar", icon: "Home", tone: "green", updatedAt: "2026-10-20T00:00:00.000Z" },
      ],
    });
    const restored = replaceStoreContents(renamedHere, imported, { scope: "all", now });

    expect(byId(restored.categories, "cat-home")).toMatchObject({ name: "Casa", updatedAt: stamp });
    for (const merged of [
      mergeExpenseStores(restored, renamedHere),
      mergeExpenseStores(renamedHere, restored),
    ]) {
      expect(byId(merged.categories, "cat-home")?.name).toBe("Casa");
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

  it("is what the replace mode of importStoreInStore does", () => {
    expect(importStoreInStore(current, imported, { mode: "replace", scope: "all", now })).toEqual(
      replaced,
    );
  });
});
