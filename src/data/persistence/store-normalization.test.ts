import { describe, expect, it } from "vitest";
import {
  assignExpenseStoreOwner,
  normalizeExpenseStore,
  normalizeImportedExpenseStore,
} from "./store-normalization";

describe("normalizeExpenseStore", () => {
  it("keeps all current export fields", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 3,
      categories: [{ id: "cat", name: "Casa" }],
      templates: [{ id: "tpl", name: "Alquiler" }],
      overrides: [{ id: "ovr", templateId: "tpl" }],
      finance: {
        incomeEvents: [{ id: "evt", name: "Extra" }],
        monthlySalary: {
          "2026-06": {
            amount: 2000,
            dayOfMonth: 28,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        monthlySavingsTargets: {
          "2026-06": {
            amount: 300,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        monthlySavingsContributions: {
          "2026-06": {
            amount: 300,
            source: "legacy",
          },
        },
        accounts: [{ id: "legacy-account", name: "Principal" }],
      },
      bankMovements: [{ id: "legacy-movement" }],
      preferences: {
        theme: "vice-afterglow",
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
          "2026-06": {
            amount: 300,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        monthlySavingsContributions: {
          "2026-06": {
            amount: 300,
            source: "legacy",
          },
        },
      },
      preferences: {
        theme: "vice-afterglow",
        language: "en",
      },
    });
    expect(store.schemaVersion).toBe(3);
    expect("accounts" in store.finance).toBe(false);
    expect("bankMovements" in store).toBe(false);
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
      monthlySavingsContributions: {},
    });
    expect(store.preferences).toEqual({
      theme: "vice-afterglow",
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
        monthlySavingsContributions: {},
      },
      preferences: {
        theme: "vice-afterglow",
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
    expect("bankMovements" in store).toBe(false);
  });

  it("keeps a corrected paid override over its matched legacy movement", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 2,
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
          id: "ovr-manual-correction",
          userId: "demo",
          templateId: "tpl-dazn",
          occurrenceDate: "2026-06-13",
          status: "paid",
          paidAt: "2026-06-16T18:30:00.000Z",
          amountPaid: 12.5,
          note: "Importe corregido por el usuario",
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

    expect(store.overrides).toEqual([
      expect.objectContaining({
        id: "ovr-manual-correction",
        occurrenceDate: "2026-06-13",
        paidAt: "2026-06-16T18:30:00.000Z",
        amountPaid: 12.5,
        note: "Importe corregido por el usuario",
      }),
    ]);
    expect("bankMovements" in store).toBe(false);
  });

  it("does not invent paid occurrences from merchant aliases", () => {
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

    expect(store.overrides).toEqual([]);
    expect("bankMerchantAliases" in store).toBe(false);
  });

  it("migrates only explicit legacy savings through the current month", () => {
    const store = normalizeExpenseStore(
      {
        finance: {
          monthlySavingsTargets: {
            "2026-06": 300,
            "2026-09": 450,
          },
        },
      },
      new Date("2026-08-23T12:00:00"),
    );

    expect(store.finance.monthlySavingsContributions).toMatchObject({
      "2026-06": {
        amount: 300,
        source: "legacy",
      },
    });
    expect(store.finance.monthlySavingsContributions?.["2026-09"])
      .toBeUndefined();
  });

  it("keeps v2 savings goals separate from real contributions", () => {
    const store = normalizeExpenseStore(
      {
        schemaVersion: 3,
        finance: {
          monthlySavingsTargets: {
            "2026-06": { amount: 300, updatedAt: "2026-06-01T00:00:00.000Z" },
          },
        },
      },
      new Date("2026-08-23T12:00:00"),
    );

    expect(store.finance.monthlySavingsTargets["2026-06"]).toMatchObject({
      amount: 300,
    });
    expect(store.finance.monthlySavingsContributions).toEqual({});
  });
});
