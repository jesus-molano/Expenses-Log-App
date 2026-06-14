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

  it("repairs imported paid overrides stored on bank booked dates", () => {
    const store = normalizeExpenseStore({
      categories: [],
      templates: [
        {
          id: "tpl-dazn",
          userId: "demo",
          name: "Dazn",
          description: "",
          amount: 14.99,
          currency: "EUR",
          categoryId: "cat",
          startDate: "2026-06-13",
          dueDay: 13,
          recurrence: { frequency: "monthly" },
          active: true,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      overrides: [
        {
          id: "ovr-import",
          userId: "demo",
          templateId: "tpl-dazn",
          occurrenceDate: "2026-06-15",
          status: "paid",
          paidAt: "2026-06-15T12:00:00.000Z",
          amountPaid: 14.99,
          note: "Creado desde importacion bancaria: DAZN",
        },
      ],
      bankMovements: [
        {
          id: "mov-dazn",
          userId: "demo",
          fingerprint: "fingerprint-dazn",
          bookedAt: "2026-06-15",
          description: "DAZN",
          amount: -14.99,
          currency: "EUR",
          merchantKey: "dazn",
          importBatchId: "batch",
          matchedTemplateId: "tpl-dazn",
          matchedOccurrenceDate: "2026-06-15",
          createdAt: "2026-06-15T00:00:00.000Z",
        },
      ],
    });

    expect(store.overrides[0]).toMatchObject({
      occurrenceDate: "2026-06-13",
      status: "paid",
    });
    expect(store.bankMovements[0]).toMatchObject({
      matchedOccurrenceDate: "2026-06-13",
    });
  });

  it("materializes paid overrides for imported alias occurrences before today only", () => {
    const store = normalizeExpenseStore({
      categories: [],
      templates: [
        {
          id: "tpl-import",
          userId: "demo",
          name: "Udon Meridiano",
          description: "",
          amount: 39.9,
          currency: "EUR",
          categoryId: "cat",
          startDate: "2000-01-01",
          dueDay: 1,
          recurrence: { frequency: "once" },
          active: true,
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
        {
          id: "tpl-future",
          userId: "demo",
          name: "Future Import",
          description: "",
          amount: 29,
          currency: "EUR",
          categoryId: "cat",
          startDate: "2999-01-01",
          dueDay: 1,
          recurrence: { frequency: "once" },
          active: true,
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      overrides: [],
      bankMerchantAliases: [
        {
          id: "alias-past",
          userId: "demo",
          merchantKey: "udon meridiano",
          templateId: "tpl-import",
          label: "UDON MERIDIANO",
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
        {
          id: "alias-future",
          userId: "demo",
          merchantKey: "future import",
          templateId: "tpl-future",
          label: "FUTURE IMPORT",
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    });

    expect(store.overrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "tpl-import",
          occurrenceDate: "2000-01-01",
          status: "paid",
          amountPaid: 39.9,
        }),
      ]),
    );
    expect(
      store.overrides.some(
        (override) =>
          override.templateId === "tpl-future" &&
          override.occurrenceDate === "2999-01-01",
      ),
    ).toBe(false);
  });
});
