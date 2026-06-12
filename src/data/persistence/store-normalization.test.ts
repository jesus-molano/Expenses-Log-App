import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import {
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
});
