import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import {
  assignExpenseStoreOwner,
  inferStoreOwnerId,
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

  it("keeps valid month closures and drops malformed ones", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 3,
      finance: {
        monthClosures: {
          "2026-10": { closedAt: "2026-10-28T10:00:00.000Z" },
          "2026-09": {
            closedAt: "2026-09-29T10:00:00.000Z",
            reopenedAt: "2026-09-29T11:00:00.000Z",
            updatedAt: "2026-09-29T11:00:00.000Z",
          },
          october: { closedAt: "2026-10-28T10:00:00.000Z" },
          "2026-08": { closedAt: "not a date" },
        },
      },
    });

    expect(store.finance.monthClosures).toEqual({
      "2026-10": {
        closedAt: "2026-10-28T10:00:00.000Z",
        updatedAt: "2026-10-28T10:00:00.000Z",
      },
      "2026-09": {
        closedAt: "2026-09-29T10:00:00.000Z",
        reopenedAt: "2026-09-29T11:00:00.000Z",
        updatedAt: "2026-09-29T11:00:00.000Z",
      },
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

  it("drops imported entities that would break the app and keeps the rest", () => {
    const store = normalizeImportedExpenseStore({
      schemaVersion: 3,
      categories: [{ id: "cat", name: "Casa" }, { name: "Sin id" }],
      templates: [
        {
          id: "rent",
          name: "Alquiler",
          amount: 700,
          startDate: "2026-10-01",
          dueDay: 1,
          recurrence: { frequency: "monthly" },
        },
        { id: "no-rule", name: "Sin regla", amount: 10, startDate: "2026-10-01", dueDay: 1 },
        { id: "bad-amount", name: "Importe", amount: "mucho" },
        { name: "Sin id", amount: 5 },
        "texto",
      ],
      overrides: [
        { id: "ok", templateId: "rent", occurrenceDate: "2026-10-01", status: "paid" },
        { id: "bad-date", templateId: "rent", occurrenceDate: "2026-13-45", status: "paid" },
        { id: "bad-status", templateId: "rent", occurrenceDate: "2026-10-01", status: "lost" },
      ],
      occurrenceRecords: [{ id: "record:x", templateId: "x", occurrenceDate: "nunca" }],
      finance: {
        incomeEvents: [
          { id: "evt", name: "Extra", amount: 40, receivedAt: "2026-10-10" },
          { id: "evt-bad", name: "Extra", amount: 40, receivedAt: "ayer" },
        ],
      },
    });

    expect(store.categories.map((category) => category.id)).toEqual(["cat"]);
    expect(store.templates.map((template) => template.id)).toEqual(["rent", "no-rule"]);
    expect(store.templates[1].recurrence).toEqual({ frequency: "monthly" });
    expect(store.overrides.map((override) => override.templateId)).toEqual(["rent"]);
    expect(store.overrides[0].status).toBe("paid");
    expect(store.occurrenceRecords?.some((record) => record.id === "record:x")).toBe(false);
    expect(store.finance.incomeEvents.map((event) => event.id)).toEqual(["evt"]);
  });

  it("loads a valid store the same way through import and normal load", () => {
    const value = {
      schemaVersion: 3,
      categories: [{ id: "cat", userId: "demo", name: "Casa", icon: "Home", tone: "green" }],
      templates: [
        {
          id: "rent",
          userId: "demo",
          name: "Alquiler",
          description: "",
          amount: 700,
          currency: "EUR",
          categoryId: "cat",
          startDate: "2026-10-01",
          dueDay: 1,
          recurrence: { frequency: "monthly" },
          active: true,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      overrides: [],
      finance: { incomeEvents: [], monthlySalary: {}, monthlySavingsTargets: {} },
      futureField: { kept: true },
    };
    const today = new Date();

    expect(normalizeImportedExpenseStore(value)).toEqual(normalizeExpenseStore(value, today));
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

  it("infers the account that owns local data from its ids", () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const anonymous = normalizeExpenseStore({
      schemaVersion: 3,
      templates: [{ id: "tpl", userId: "demo", name: "Luz" }],
      overrides: [{ id: "ovr", userId: "demo", templateId: "tpl" }],
    });

    expect(inferStoreOwnerId(emptyStore)).toBeNull();
    expect(inferStoreOwnerId(anonymous)).toBeNull();
    expect(inferStoreOwnerId(assignExpenseStoreOwner(anonymous, ownerId))).toBe(
      ownerId,
    );
    // Lo creado sin sesión encima de datos sincronizados sigue siendo de esa
    // cuenta.
    expect(
      inferStoreOwnerId({
        ...anonymous,
        overrides: [{ ...anonymous.overrides[0], userId: ownerId }],
      }),
    ).toBe(ownerId);
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
        id: "ovr:tpl-dazn:2026-06-13",
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
  it("keeps fields written by newer builds in v3 stores", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 4,
      categories: [],
      templates: [],
      overrides: [],
      futureFeature: { enabled: true },
      bankMovements: [{ id: "retired-movement" }],
      finance: {
        incomeEvents: [],
        monthlySalary: {},
        monthlySavingsTargets: {},
        monthClosures: {
          "2026-10": {
            closedAt: "2026-10-30T10:00:00.000Z",
            updatedAt: "2026-10-30T10:00:00.000Z",
          },
        },
        accounts: [{ id: "retired-account" }],
      },
      deleted: {
        templates: ["tpl-old"],
        monthClosures: { "2026-09": "2026-10-01T00:00:00.000Z" },
      },
      preferences: {
        theme: "nord",
        language: "es",
        defaultReminderDays: 3,
      },
    });

    expect(store).toMatchObject({
      futureFeature: { enabled: true },
      finance: {
        monthClosures: {
          "2026-10": { closedAt: "2026-10-30T10:00:00.000Z" },
        },
      },
      deleted: {
        templates: ["tpl-old"],
        monthClosures: { "2026-09": "2026-10-01T00:00:00.000Z" },
      },
      preferences: { theme: "nord", defaultReminderDays: 3 },
    });
    expect("bankMovements" in store).toBe(false);
    expect("accounts" in store.finance).toBe(false);
  });

  it("drops unknown fields from legacy stores before v3", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 2,
      categories: [],
      templates: [],
      overrides: [],
      legacyOnly: true,
      finance: { legacyFinance: true },
    });

    expect("legacyOnly" in store).toBe(false);
    expect("legacyFinance" in store.finance).toBe(false);
  });
  it("repairs impossible template dates instead of breaking the store", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 3,
      categories: [],
      overrides: [],
      templates: [
        { id: "clamped", startDate: "2026-11-31", dueDay: 31, createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "garbage", startDate: "soon", endDate: "", dueDay: "x", createdAt: "2026-10-05T00:00:00.000Z" },
        { id: "ended", startDate: "2026-06-01", endDate: "someday", dueDay: 1 },
        "not a template",
      ],
    });

    expect(store.templates).toMatchObject([
      { id: "clamped", startDate: "2026-11-30", dueDay: 31 },
      { id: "garbage", startDate: "2026-10-05", endDate: undefined, dueDay: 5 },
      { id: "ended", startDate: "2026-06-01", endDate: "2026-06-01" },
    ]);
  });

  it("keeps category timestamps and still loads categories written without them", () => {
    const store = normalizeExpenseStore({
      schemaVersion: 3,
      categories: [
        { id: "new", name: "Casa", icon: "Home", tone: "green", updatedAt: "2026-10-23T10:00:00.000Z" },
        { id: "old", name: "Ocio", icon: "Gamepad2", tone: "violet" },
        { id: "broken", name: "Salud", icon: "HeartPulse", tone: "rose", updatedAt: "ayer" },
        null,
      ],
    });

    expect(store.categories).toEqual([
      { id: "new", name: "Casa", icon: "Home", tone: "green", updatedAt: "2026-10-23T10:00:00.000Z" },
      { id: "old", name: "Ocio", icon: "Gamepad2", tone: "violet" },
      { id: "broken", name: "Salud", icon: "HeartPulse", tone: "rose" },
    ]);
  });
});
