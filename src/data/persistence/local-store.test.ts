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
  deleteBalanceCheckinInStore,
  recordBalanceInStore,
  reopenMonthInStore,
  updateBudgetCycleInStore,
} from "@/stores/app/finance-commands";
import {
  addBalanceAccountInStore,
  deleteAccountBalanceInStore,
  deleteBalanceAccountInStore,
  recordAccountBalanceInStore,
  updateBalanceAccountInStore,
} from "@/stores/app/account-commands";
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
import { normalizeExpenseStore } from "./store-normalization";

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

  it("keeps the most recent budget cycle choice from either store", () => {
    const payday = updateBudgetCycleInStore(
      emptyStore,
      "payday",
      new Date("2026-10-20T10:00:00.000Z"),
    );
    const backToCalendar = updateBudgetCycleInStore(
      payday,
      "calendar",
      new Date("2026-10-21T10:00:00.000Z"),
    );

    expect(mergeExpenseStores(payday, backToCalendar).finance.budgetCycle).toEqual(
      backToCalendar.finance.budgetCycle,
    );
    expect(mergeExpenseStores(backToCalendar, payday).finance.budgetCycle).toEqual(
      backToCalendar.finance.budgetCycle,
    );
    // Solo uno de los dos lo ha elegido: se conserva.
    expect(mergeExpenseStores(emptyStore, payday).finance.budgetCycle?.anchor).toBe("payday");
    expect(mergeExpenseStores(payday, emptyStore).finance.budgetCycle?.anchor).toBe("payday");
    expect("budgetCycle" in mergeExpenseStores(emptyStore, emptyStore).finance).toBe(false);
  });

  it("merges balance check-ins day by day, deletions included", () => {
    const base = recordBalanceInStore(
      recordBalanceInStore(emptyStore, { date: "2026-10-01", amount: 2100 }, new Date("2026-10-01T10:00:00.000Z")),
      { date: "2026-10-11", amount: 1600 },
      new Date("2026-10-11T10:00:00.000Z"),
    );
    // Un dispositivo borra el día 11; el otro anota el 23.
    const phone = deleteBalanceCheckinInStore(base, "2026-10-11", new Date("2026-10-20T10:00:00.000Z"));
    const laptop = recordBalanceInStore(base, { date: "2026-10-23", amount: 1250 }, new Date("2026-10-23T10:00:00.000Z"));

    for (const merged of [mergeExpenseStores(phone, laptop), mergeExpenseStores(laptop, phone)]) {
      expect(merged.finance.balanceCheckins).toEqual({
        "2026-10-01": { amount: 2100, updatedAt: "2026-10-01T10:00:00.000Z" },
        "2026-10-11": {
          amount: 1600,
          updatedAt: "2026-10-20T10:00:00.000Z",
          deletedAt: "2026-10-20T10:00:00.000Z",
        },
        "2026-10-23": { amount: 1250, updatedAt: "2026-10-23T10:00:00.000Z" },
      });
    }
    expect("balanceCheckins" in mergeExpenseStores(emptyStore, emptyStore).finance).toBe(false);
  });

  it("merges the balances of each account day by day, deletions included", () => {
    const at = (iso: string) => new Date(iso);
    const base = recordAccountBalanceInStore(
      addBalanceAccountInStore(emptyStore, { name: "Ahorro", role: "savings" }, at("2026-10-01T09:00:00.000Z"), "savings"),
      { accountId: "savings", date: "2026-10-01", amount: 5000 },
      at("2026-10-01T10:00:00.000Z"),
    );
    // El móvil borra el día 1 y anota el 20; el portátil anota el 20 antes y
    // un saldo de la cuenta de recibos.
    const phone = recordAccountBalanceInStore(
      deleteAccountBalanceInStore(base, { accountId: "savings", date: "2026-10-01" }, at("2026-10-19T10:00:00.000Z")),
      { accountId: "savings", date: "2026-10-20", amount: 5300 },
      at("2026-10-20T12:00:00.000Z"),
    );
    const laptop = recordAccountBalanceInStore(
      recordAccountBalanceInStore(base, { accountId: "savings", date: "2026-10-20", amount: 5250 }, at("2026-10-20T09:00:00.000Z")),
      { accountId: "primary", date: "2026-10-20", amount: 1200 },
      at("2026-10-20T09:00:00.000Z"),
    );

    for (const merged of [mergeExpenseStores(phone, laptop), mergeExpenseStores(laptop, phone)]) {
      expect(merged.finance.accountCheckins).toEqual({
        "savings:2026-10-01": {
          amount: 5000,
          updatedAt: "2026-10-19T10:00:00.000Z",
          deletedAt: "2026-10-19T10:00:00.000Z",
        },
        "savings:2026-10-20": { amount: 5300, updatedAt: "2026-10-20T12:00:00.000Z" },
      });
      expect(merged.finance.balanceCheckins).toEqual({
        "2026-10-20": { amount: 1200, updatedAt: "2026-10-20T09:00:00.000Z" },
      });
    }
    expect("accountCheckins" in mergeExpenseStores(emptyStore, emptyStore).finance).toBe(false);
  });

  it("merges accounts by their latest edit, and a deleted account stays deleted", () => {
    const at = (iso: string) => new Date(iso);
    const base = addBalanceAccountInStore(
      emptyStore,
      { name: "BBVA", role: "spending" },
      at("2026-10-01T09:00:00.000Z"),
      "bbva",
    );
    const renamedEarly = updateBalanceAccountInStore(base, "primary", { name: "Sabadel" }, at("2026-10-10T09:00:00.000Z"));
    const renamedLate = addBalanceAccountInStore(
      updateBalanceAccountInStore(base, "primary", { name: "Sabadell" }, at("2026-10-11T09:00:00.000Z")),
      { name: "Ahorro", role: "savings" },
      at("2026-10-11T09:00:00.000Z"),
      "savings",
    );
    // El móvil borra BBVA; el portátil, sin saberlo, la renombra después.
    const phone = deleteBalanceAccountInStore(renamedEarly, "bbva", at("2026-10-12T09:00:00.000Z"));
    const laptop = updateBalanceAccountInStore(renamedLate, "bbva", { name: "BBVA nómina" }, at("2026-10-13T09:00:00.000Z"));

    for (const merged of [mergeExpenseStores(phone, laptop), mergeExpenseStores(laptop, phone)]) {
      expect(merged.finance.balanceAccounts?.primary?.name).toBe("Sabadell");
      expect(merged.finance.balanceAccounts?.bbva).toMatchObject({
        name: "BBVA",
        deletedAt: "2026-10-12T09:00:00.000Z",
      });
      expect(merged.finance.balanceAccounts?.savings?.role).toBe("savings");
    }
    expect("balanceAccounts" in mergeExpenseStores(emptyStore, emptyStore).finance).toBe(false);
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

describe("mergeExpenseStores with categories and contract details", () => {
  it("keeps the latest rename of a category and the latest edit of a series", () => {
    const category = { id: "viajes", userId: "demo", icon: "Tag", tone: "rose" as const };
    const local = normalizeExpenseStore({
      ...emptyStore,
      categories: [{ ...category, name: "Viajes", updatedAt: "2026-10-20T00:00:00.000Z" }],
    });
    const cloud = normalizeExpenseStore({
      ...emptyStore,
      categories: [{ ...category, name: "Vacaciones", updatedAt: "2026-10-22T00:00:00.000Z" }],
    });

    expect(mergeExpenseStores(local, cloud).categories).toEqual([
      expect.objectContaining({ name: "Vacaciones" }),
    ]);
    expect(mergeExpenseStores(cloud, local).categories).toEqual([
      expect.objectContaining({ name: "Vacaciones" }),
    ]);
  });

  it("keeps a rename over an old copy of the category that never had an update time", () => {
    const category = { id: "ocio", userId: "demo", icon: "Gamepad2", tone: "violet" as const };
    const renamed = normalizeExpenseStore({
      ...emptyStore,
      categories: [{ ...category, name: "Caprichos", updatedAt: "2026-10-22T00:00:00.000Z" }],
    });
    const stale = normalizeExpenseStore({ ...emptyStore, categories: [{ ...category, name: "Ocio" }] });

    // El dispositivo con la copia antigua fusiona sus cambios con la nube.
    expect(mergeExpenseStores(stale, renamed).categories).toEqual([
      expect.objectContaining({ name: "Caprichos" }),
    ]);
    expect(mergeExpenseStores(renamed, stale).categories).toEqual([
      expect.objectContaining({ name: "Caprichos" }),
    ]);
  });

  it("does not bring back a category deleted on another device", () => {
    const category = { id: "viajes", userId: "demo", name: "Viajes", icon: "Tag", tone: "rose" as const };
    const local = normalizeExpenseStore({ ...emptyStore, categories: [category] });
    const cloud = normalizeExpenseStore({
      ...emptyStore,
      categories: [],
      deleted: { ...emptyStore.deleted, categories: ["viajes"] },
    });

    expect(mergeExpenseStores(local, cloud).categories).toEqual([]);
  });
});

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

  it("lets the local copy win when neither category has a timestamp", () => {
    const merged = mergeExpenseStores(
      { ...emptyStore, categories: [{ ...category, icon: "Local" }] },
      { ...emptyStore, categories: [{ ...category, icon: "Cloud" }] },
    );

    expect(merged.categories[0].icon).toBe("Local");
  });

  it("prefers the copy with a timestamp over an older copy without one", () => {
    const merged = mergeExpenseStores(
      { ...emptyStore, categories: [{ ...category, icon: "Local" }] },
      { ...emptyStore, categories: [{ ...category, icon: "Cloud", updatedAt: "2026-10-23T10:00:00.000Z" }] },
    );

    expect(merged.categories[0].icon).toBe("Cloud");
  });
});
