import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import { CloudSaveConflictError } from "./cloud-save-queue";
import {
  CLOUD_PULL_THROTTLE_MS,
  isTransientSyncError,
  mergeStoreFromOtherTab,
  mergeStoresForSync,
  resolveHydratedStore,
  shouldPullCloud,
  shouldQueueCloudSave,
  storesEquivalent,
} from "./sync-policy";

function storeWithTemplate(id: string): ExpenseStore {
  return {
    ...emptyStore,
    templates: [
      {
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
      },
    ],
  };
}

describe("sync policy", () => {
  it("uses cloud as source of truth when the account already has cloud data", () => {
    const local = storeWithTemplate("local");
    const cloud = storeWithTemplate("cloud");

    const result = resolveHydratedStore({
      initialLocalStore: local,
      latestLocalStore: local,
      cloudStore: cloud,
      revisionAtCloudLoad: 0,
      currentRevision: 0,
    });

    expect(result.shouldSaveCloud).toBe(false);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "cloud",
    ]);
  });

  it("uses local data as the first cloud store for a new account", () => {
    const local = storeWithTemplate("local");

    const result = resolveHydratedStore({
      initialLocalStore: local,
      latestLocalStore: local,
      cloudStore: null,
      revisionAtCloudLoad: 0,
      currentRevision: 0,
    });

    expect(result.shouldSaveCloud).toBe(true);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "local",
    ]);
  });

  it("merges edits made during async cloud hydration and saves them", () => {
    const initialLocal = storeWithTemplate("initial");
    const latestLocal = storeWithTemplate("latest");
    const cloud = storeWithTemplate("cloud");

    const result = resolveHydratedStore({
      initialLocalStore: initialLocal,
      latestLocalStore: latestLocal,
      cloudStore: cloud,
      revisionAtCloudLoad: 0,
      currentRevision: 1,
    });

    expect(result.shouldSaveCloud).toBe(true);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "cloud",
      "latest",
    ]);
    expect(result.mergedStore.templates.map((item) => item.id)).not.toContain(
      "initial",
    );
  });

  it("merges unsynced changes from a previous session instead of dropping them", () => {
    const local = storeWithTemplate("paid-offline");
    const cloud = storeWithTemplate("cloud");

    const result = resolveHydratedStore({
      initialLocalStore: local,
      latestLocalStore: local,
      cloudStore: cloud,
      revisionAtCloudLoad: 0,
      currentRevision: 0,
      localDirty: true,
    });

    expect(result.shouldSaveCloud).toBe(true);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "cloud",
      "paid-offline",
    ]);
  });

  it("queues cloud save only when session is ready", () => {
    expect(
      shouldQueueCloudSave({ hydrated: true, hasSupabase: true, hasUser: true }),
    ).toBe(true);
    expect(
      shouldQueueCloudSave({ hydrated: false, hasSupabase: true, hasUser: true }),
    ).toBe(false);
    expect(
      shouldQueueCloudSave({ hydrated: true, hasSupabase: true, hasUser: false }),
    ).toBe(false);
  });

  describe("after merging another copy", () => {
    const today = new Date(2026, 10, 2, 12);

    // El portátil movió el cobro de la luz al día 10; el móvil, sin
    // enterarse, pagó el del día 5.
    function laptopAndPhone() {
      const template = {
        ...storeWithTemplate("luz").templates[0],
        startDate: "2026-10-05",
        dueDay: 5,
      };
      const laptop: ExpenseStore = {
        ...emptyStore,
        templates: [{ ...template, dueDay: 10, updatedAt: "2026-11-02T10:01:00.000Z" }],
      };
      const phone: ExpenseStore = {
        ...emptyStore,
        templates: [template],
        overrides: [
          {
            id: "ovr:luz:2026-11-05",
            userId: "user",
            templateId: "luz",
            occurrenceDate: "2026-11-05",
            status: "paid",
            paidAt: "2026-11-02T10:02:00.000Z",
            amountPaid: 1,
            updatedAt: "2026-11-02T10:02:00.000Z",
            statusUpdatedAt: "2026-11-02T10:02:00.000Z",
          },
        ],
      };
      return { laptop, phone };
    }

    function paidDates(store: ExpenseStore) {
      return store.overrides
        .filter((override) => override.status === "paid")
        .map((override) => override.occurrenceDate);
    }

    it("re-keys payments left on a date the series no longer generates", () => {
      const { laptop, phone } = laptopAndPhone();

      expect(paidDates(mergeExpenseStores(laptop, phone))).toEqual(["2026-11-05"]);
      expect(paidDates(mergeStoresForSync(laptop, phone, today))).toEqual(["2026-11-10"]);
    });

    it("reconciles when merging local changes during hydration", () => {
      const { laptop, phone } = laptopAndPhone();

      const result = resolveHydratedStore({
        initialLocalStore: laptop,
        latestLocalStore: laptop,
        cloudStore: phone,
        revisionAtCloudLoad: 0,
        currentRevision: 0,
        localDirty: true,
        today,
      });

      expect(result.shouldSaveCloud).toBe(true);
      expect(paidDates(result.mergedStore)).toEqual(["2026-11-10"]);
    });

    it("uploads the fix when the cloud itself has orphan overrides", () => {
      const { laptop, phone } = laptopAndPhone();
      const orphanCloud = mergeExpenseStores(laptop, phone);

      const result = resolveHydratedStore({
        initialLocalStore: emptyStore,
        latestLocalStore: emptyStore,
        cloudStore: orphanCloud,
        revisionAtCloudLoad: 0,
        currentRevision: 0,
        today,
      });

      expect(result.shouldSaveCloud).toBe(true);
      expect(paidDates(result.mergedStore)).toEqual(["2026-11-10"]);
    });

    it("keeps the cloud as is when it has nothing to reconcile", () => {
      const cloud = storeWithTemplate("cloud");

      const result = resolveHydratedStore({
        initialLocalStore: emptyStore,
        latestLocalStore: emptyStore,
        cloudStore: cloud,
        revisionAtCloudLoad: 0,
        currentRevision: 0,
        today,
      });

      expect(result).toEqual({ mergedStore: cloud, shouldSaveCloud: false });
    });
  });

  it("takes preferences from the latest tab write when merging tabs", () => {
    const current: ExpenseStore = {
      ...storeWithTemplate("a"),
      preferences: { theme: "nord", language: "es" },
    };
    const otherTab: ExpenseStore = {
      ...storeWithTemplate("b"),
      preferences: { theme: "dracula", language: "en" },
    };

    const merged = mergeStoreFromOtherTab(current, otherTab);

    expect(merged.templates.map((item) => item.id)).toEqual(["b", "a"]);
    expect(merged.preferences).toEqual({ theme: "dracula", language: "en" });
  });

  it("compares stores by content, not key order", () => {
    const store = storeWithTemplate("a");
    const reordered = JSON.parse(
      JSON.stringify({
        preferences: store.preferences,
        deleted: store.deleted,
        finance: store.finance,
        overrides: store.overrides,
        templates: store.templates,
        categories: store.categories,
        schemaVersion: store.schemaVersion,
      }),
    ) as ExpenseStore;

    expect(storesEquivalent(store, reordered)).toBe(true);
    expect(storesEquivalent(store, storeWithTemplate("b"))).toBe(false);
    // Una copia normalizada (con todos los valores por defecto) es la misma.
    expect(storesEquivalent(store, normalizeExpenseStore(store))).toBe(true);
  });

  it("pulls the cloud only when ready, idle and not too often", () => {
    const base = { cloudReady: true, busy: false, lastCloudContactAt: 0 };

    expect(shouldPullCloud({ ...base, now: CLOUD_PULL_THROTTLE_MS })).toBe(true);
    expect(shouldPullCloud({ ...base, now: CLOUD_PULL_THROTTLE_MS - 1 })).toBe(false);
    expect(
      shouldPullCloud({ ...base, busy: true, now: CLOUD_PULL_THROTTLE_MS }),
    ).toBe(false);
    expect(
      shouldPullCloud({ ...base, cloudReady: false, now: CLOUD_PULL_THROTTLE_MS }),
    ).toBe(false);
  });

  it("treats a save that kept conflicting as a temporary failure", () => {
    expect(isTransientSyncError(new CloudSaveConflictError())).toBe(true);
    expect(isTransientSyncError({ code: "42501", message: "denied" })).toBe(false);
  });
});
