import { describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrenceRecord,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import {
  clearIncomeFromStore,
  closeMonthInStore,
  reopenMonthInStore,
} from "@/stores/app/finance-commands";
import { updateReminderPreferencesInStore } from "@/stores/app/preference-commands";
import {
  EXPENSE_STORE_KEY,
  clearExpenseLocalData,
  loadExpenseStore,
  markExpenseStoreSeen,
  mergeExpenseStores,
  readExpenseStoreFromOtherTab,
  saveExpenseStore,
} from "./local-store";

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

  it("does not bring back salaries cleared offline, older copies included", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    const salary = (amount: number, updatedAt: string) => ({
      amount,
      dayOfMonth: 28,
      updatedAt,
    });
    // La nube tiene el sueldo de junio de antes; este dispositivo lo cambió
    // sin conexión y después borró los ingresos.
    const cloud: ExpenseStore = {
      ...emptyStore,
      schemaVersion: 3,
      finance: {
        ...emptyStore.finance,
        monthlySalary: {
          "2026-06": salary(2000, "2026-06-01T00:00:00.000Z"),
          "2026-07": salary(2000, "2026-06-01T00:00:00.000Z"),
        },
      },
    };
    const editedOffline = {
      ...cloud,
      finance: {
        ...cloud.finance,
        monthlySalary: {
          ...cloud.finance.monthlySalary,
          "2026-06": salary(2400, "2026-06-10T00:00:00.000Z"),
        },
      },
    };
    const clearedLocal = clearIncomeFromStore(editedOffline);
    vi.useRealTimers();

    expect(mergeExpenseStores(clearedLocal, cloud).finance.monthlySalary)
      .toEqual({});
    expect(clearedLocal.deleted?.monthlySalary).toEqual([
      "*@2026-06-15T00:00:00.000Z",
    ]);

    // Un sueldo puesto después del borrado, en otro dispositivo, se queda.
    const editedLater = salary(2300, "2026-06-20T00:00:00.000Z");
    const merged = mergeExpenseStores(clearedLocal, {
      ...cloud,
      finance: {
        ...cloud.finance,
        monthlySalary: { ...cloud.finance.monthlySalary, "2026-07": editedLater },
      },
    });
    expect(merged.finance.monthlySalary).toEqual({ "2026-07": editedLater });
  });

  it("keeps the latest close or reopen of a month from either store", () => {
    const closed = closeMonthInStore(
      emptyStore,
      "2026-10",
      new Date("2026-10-28T10:00:00.000Z"),
    );
    const reopened = reopenMonthInStore(
      closed,
      "2026-10",
      new Date("2026-10-28T11:00:00.000Z"),
    );

    expect(mergeExpenseStores(closed, reopened).finance.monthClosures)
      .toEqual(reopened.finance.monthClosures);
    expect(mergeExpenseStores(reopened, closed).finance.monthClosures)
      .toEqual(reopened.finance.monthClosures);
    expect("monthClosures" in mergeExpenseStores(emptyStore, emptyStore).finance)
      .toBe(false);
  });

  it("keeps the latest reminder settings from either device", () => {
    const older = updateReminderPreferencesInStore(
      emptyStore,
      { defaultEnabled: true, pushHour: 9 },
      new Date("2026-10-20T10:00:00.000Z"),
    );
    const newer = updateReminderPreferencesInStore(
      emptyStore,
      { defaultEnabled: false, pushHour: 20 },
      new Date("2026-10-21T10:00:00.000Z"),
    );

    // El resto de preferencias gana la local; los avisos, la última edición.
    expect(mergeExpenseStores(older, newer).preferences?.reminders).toMatchObject({
      pushHour: 20,
    });
    expect(mergeExpenseStores(newer, older).preferences?.reminders).toMatchObject({
      pushHour: 20,
    });
    expect(mergeExpenseStores(emptyStore, older).preferences?.reminders).toMatchObject({
      pushHour: 9,
    });
    expect("reminders" in (mergeExpenseStores(emptyStore, emptyStore).preferences ?? {}))
      .toBe(false);
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
    window.localStorage.setItem("expense-log-store-v1", "{still not json");
    expect(loadExpenseStore()).toBe(emptyStore);

    expect(window.localStorage.getItem("expense-log-store-v1.corrupt")).toBe(
      "{still not json",
    );
    window.localStorage.clear();
  });

  it("removes corrupt-store copies and sync metadata together with the local data", () => {
    window.localStorage.setItem("expense-log-store-v1", "{}");
    window.localStorage.setItem("expense-log-store-v1.corrupt", "{a");
    window.localStorage.setItem("expense-log-store-v1.corrupt-1760000000000", "{b");
    window.localStorage.setItem(
      "expense-log-sync-v1",
      JSON.stringify({ ownerId: "user-a", dirty: true, updatedAt: "" }),
    );
    window.localStorage.setItem("expense-theme", "nord");

    clearExpenseLocalData();

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem("expense-theme")).toBe("nord");
    window.localStorage.clear();
  });
});

describe("readExpenseStoreFromOtherTab", () => {
  it("returns only what another tab wrote after this one", () => {
    saveExpenseStore(storeWithTemplate("mine"));
    expect(readExpenseStoreFromOtherTab()).toBeNull();

    const raw = JSON.stringify(storeWithTemplate("other-tab"));
    window.localStorage.setItem(EXPENSE_STORE_KEY, raw);
    const other = readExpenseStoreFromOtherTab();
    expect(other?.raw).toBe(raw);
    expect(other?.store.templates.map((item) => item.id)).toEqual(["other-tab"]);

    // Ya incorporado por esta pestaña: no vuelve a contar como ajeno.
    markExpenseStoreSeen(raw);
    expect(readExpenseStoreFromOtherTab()).toBeNull();
    window.localStorage.clear();
  });

  it("ignores missing or unreadable stores", () => {
    window.localStorage.removeItem(EXPENSE_STORE_KEY);
    expect(readExpenseStoreFromOtherTab()).toBeNull();
    window.localStorage.setItem(EXPENSE_STORE_KEY, "{not json");
    expect(readExpenseStoreFromOtherTab()).toBeNull();
    window.localStorage.clear();
  });
});

describe("mergeExpenseStores categories", () => {
  const category = {
    id: "cat-1",
    userId: "user",
    name: "Casa",
    icon: "Home",
    tone: "green" as const,
  };

  it("keeps the most recently updated category", () => {
    const newer = { ...category, icon: "House", updatedAt: "2026-10-23T11:00:00.000Z" };
    const older = { ...category, icon: "Home", updatedAt: "2026-10-23T10:00:00.000Z" };

    for (const [local, cloud] of [
      [newer, older],
      [older, newer],
    ]) {
      const merged = mergeExpenseStores(
        { ...emptyStore, categories: [local] },
        { ...emptyStore, categories: [cloud] },
      );
      expect(merged.categories).toEqual([newer]);
    }
  });

  it("lets the local copy win for categories without a timestamp", () => {
    const merged = mergeExpenseStores(
      { ...emptyStore, categories: [{ ...category, icon: "Local" }] },
      { ...emptyStore, categories: [{ ...category, icon: "Cloud", updatedAt: "2026-10-23T10:00:00.000Z" }] },
    );

    expect(merged.categories[0].icon).toBe("Local");
  });
});
