import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import {
  assignExpenseStoreOwner,
  normalizeExpenseStore,
  normalizeImportedExpenseStore,
} from "./store-normalization";

describe("normalizeExpenseStore", () => {
  it("keeps all current export fields", () => {
    const store = normalizeExpenseStore({
      categories: [{ id: "cat", name: "Casa" }],
      templates: [{ id: "tpl", name: "Alquiler" }],
      overrides: [{ id: "ovr", templateId: "tpl" }],
      finance: {
        incomeEvents: [{ id: "evt", name: "Extra" }],
        monthlySalary: {
          "2026-06": {
            amount: 2000,
            dayOfMonth: 28,
          },
        },
        monthlySavingsTargets: {
          "2026-06": 300,
        },
        accounts: [
          {
            id: "acct",
            name: "Principal",
            purposes: ["salary", "daily"],
          },
        ],
      },
      preferences: {
        theme: "light",
        language: "en",
      },
    });

    expect(store).toMatchObject({
      categories: [{ id: "cat", name: "Casa" }],
      templates: [{ id: "tpl", name: "Alquiler" }],
      overrides: [{ id: "ovr", templateId: "tpl" }],
      finance: {
        incomeEvents: [{ id: "evt", name: "Extra" }],
        monthlySalary: {
          "2026-06": {
            amount: 2000,
            dayOfMonth: 28,
          },
        },
        monthlySavingsTargets: {
          "2026-06": 300,
        },
        accounts: [
          {
            id: "acct",
            name: "Principal",
            purposes: ["salary", "daily"],
          },
        ],
      },
      preferences: {
        theme: "light",
        language: "en",
      },
    });
  });

  it("adds defaults for old exports without finance or preferences", () => {
    const store = normalizeImportedExpenseStore({
      categories: [],
      templates: [],
      overrides: [],
    });

    expect(store.finance).toEqual({
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets: {},
      accounts: emptyFinanceStore.accounts,
    });
    expect(store.preferences).toEqual({
      theme: "dark",
      language: "es",
    });
  });

  it("falls back to a safe empty shape for invalid payloads", () => {
    expect(normalizeExpenseStore(null)).toMatchObject({
      categories: [],
      templates: [],
      overrides: [],
      finance: {
        incomeEvents: [],
        monthlySalary: {},
        monthlySavingsTargets: {},
        accounts: emptyFinanceStore.accounts,
      },
      preferences: {
        theme: "dark",
        language: "es",
      },
    });
  });

  it("rejects valid JSON that is not an app export during manual import", () => {
    expect(() => normalizeImportedExpenseStore([])).toThrow(
      "Invalid expense store export.",
    );
    expect(() => normalizeImportedExpenseStore({})).toThrow(
      "Invalid expense store export.",
    );
  });

  it("assigns the authenticated user id to nested store entities", () => {
    const store = normalizeExpenseStore({
      categories: [{ id: "cat", userId: "demo" }],
      templates: [{ id: "tpl", userId: "demo" }],
      overrides: [{ id: "ovr", userId: "demo" }],
      finance: {
        incomeEvents: [{ id: "evt", userId: "demo" }],
      },
    });

    const ownedStore = assignExpenseStoreOwner(
      store,
      "11111111-1111-4111-8111-111111111111",
    );

    expect(ownedStore.categories[0].userId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(ownedStore.templates[0].userId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(ownedStore.overrides[0].userId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(ownedStore.finance.incomeEvents[0].userId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
