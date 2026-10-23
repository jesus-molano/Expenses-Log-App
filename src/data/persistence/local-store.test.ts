import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceRecord,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import { loadExpenseStore, mergeExpenseStores } from "./local-store";

function template(id: string): ExpenseTemplate {
  return {
    id,
    userId: "user",
    name: id,
    description: "",
    amount: 1,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-06-01",
    dueDay: 1,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function storeWithTemplate(id: string): ExpenseStore {
  return {
    ...emptyStore,
    templates: [template(id)],
  };
}

describe("mergeExpenseStores", () => {
  it("does not resurrect cloud templates deleted locally", () => {
    const localStore: ExpenseStore = {
      ...emptyStore,
      deleted: {
        templates: ["deleted-template"],
      },
    };
    const cloudStore = storeWithTemplate("deleted-template");

    const merged = mergeExpenseStores(localStore, cloudStore);

    expect(merged.templates).toEqual([]);
    expect(merged.deleted?.templates).toContain("deleted-template");
  });

  it("keeps the newest occurrence snapshot across local and cloud", () => {
    const cloudRecord = occurrenceRecord({
      name: "Internet antiguo",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    const localRecord = occurrenceRecord({
      name: "Internet corregido",
      updatedAt: "2026-06-10T00:00:00.000Z",
    });

    const merged = mergeExpenseStores(
      {
        ...emptyStore,
        schemaVersion: 3,
        occurrenceRecords: [localRecord],
      },
      {
        ...emptyStore,
        schemaVersion: 3,
        occurrenceRecords: [cloudRecord],
      },
    );

    expect(merged.occurrenceRecords).toMatchObject([
      { id: cloudRecord.id, name: "Internet corregido" },
    ]);
  });

  it("honors a deleted contribution and allows a new contribution for the month", () => {
    const cloudContribution = {
      id: "saving:2026-06:old",
      userId: "user",
      monthId: "2026-06",
      amount: 300,
      transferredAt: "2026-06-05",
      source: "manual" as const,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    };
    const deletedLocal: ExpenseStore = {
      ...emptyStore,
      schemaVersion: 3,
      finance: {
        ...emptyStore.finance,
        monthlySavingsContributions: {},
      },
      deleted: {
        ...emptyStore.deleted,
        savingsContributions: [cloudContribution.id],
      },
    };
    const cloud: ExpenseStore = {
      ...emptyStore,
      schemaVersion: 3,
      finance: {
        ...emptyStore.finance,
        monthlySavingsContributions: {
          "2026-06": cloudContribution,
        },
      },
    };

    const deleted = mergeExpenseStores(deletedLocal, cloud);
    expect(deleted.finance.monthlySavingsContributions).toEqual({});

    const replacement = {
      ...cloudContribution,
      id: "saving:2026-06:new",
      amount: 450,
      updatedAt: "2026-06-12T00:00:00.000Z",
    };
    const readded = mergeExpenseStores(
      {
        ...deletedLocal,
        finance: {
          ...deletedLocal.finance,
          monthlySavingsContributions: { "2026-06": replacement },
        },
      },
      cloud,
    );

    expect(readded.finance.monthlySavingsContributions?.["2026-06"])
      .toMatchObject({ id: replacement.id, amount: 450 });
  });

  it("keeps fields it does not know from both stores", () => {
    const local = {
      ...emptyStore,
      schemaVersion: 3,
      localOnly: "local",
      finance: {
        ...emptyStore.finance,
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-30T10:00:00.000Z",
            updatedAt: "2026-10-30T10:00:00.000Z",
          },
          "2026-09": {
            closedAt: "2026-09-29T10:00:00.000Z",
            updatedAt: "2026-09-29T10:00:00.000Z",
          },
        },
      },
      deleted: { ...emptyStore.deleted, futureIds: ["a"] },
    } as ExpenseStore;
    const cloud = {
      ...emptyStore,
      schemaVersion: 3,
      cloudOnly: "cloud",
      finance: {
        ...emptyStore.finance,
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-30T10:00:00.000Z",
            reopenedAt: "2026-10-31T09:00:00.000Z",
            updatedAt: "2026-10-31T09:00:00.000Z",
          },
        },
      },
      deleted: { ...emptyStore.deleted, futureIds: ["b"] },
    } as ExpenseStore;

    const merged = mergeExpenseStores(
      JSON.parse(JSON.stringify(local)),
      JSON.parse(JSON.stringify(cloud)),
    ) as ExpenseStore & Record<string, unknown>;

    expect(merged.localOnly).toBe("local");
    expect(merged.cloudOnly).toBe("cloud");
    expect(merged.finance).toMatchObject({
      monthClosures: {
        "2026-10": { reopenedAt: "2026-10-31T09:00:00.000Z" },
        "2026-09": { closedAt: "2026-09-29T10:00:00.000Z" },
      },
    });
    expect(
      (merged.deleted as Record<string, unknown>).futureIds,
    ).toEqual(["b", "a"]);
  });
});

function occurrenceRecord(
  overrides: Partial<ExpenseOccurrenceRecord> = {},
): ExpenseOccurrenceRecord {
  return {
    id: "record:internet:2026-06-08",
    userId: "user",
    templateId: "internet",
    occurrenceDate: "2026-06-08",
    monthId: "2026-06",
    dueDate: "2026-06-08",
    name: "Internet",
    description: "Fibra",
    plannedAmount: 60,
    currency: "EUR",
    categoryId: "services",
    categoryName: "Servicios",
    status: "paid",
    sortOrder: 0,
    paidAt: "2026-06-08T12:00:00.000Z",
    amountPaid: 60,
    source: "native",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loadExpenseStore", () => {
  it("keeps a copy of an unreadable store before falling back to empty", () => {
    window.localStorage.setItem("expense-log-store-v1", "{not json");

    expect(loadExpenseStore()).toBe(emptyStore);

    const backups = Object.keys(window.localStorage).filter((key) =>
      key.startsWith("expense-log-store-v1.corrupt-"),
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe("{not json");
    window.localStorage.clear();
  });
});
