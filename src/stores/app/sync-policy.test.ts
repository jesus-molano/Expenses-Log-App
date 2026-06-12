import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { resolveHydratedStore, shouldQueueCloudSave } from "./sync-policy";

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
  it("hydrates React state when cloud merge did not race local changes", () => {
    const local = storeWithTemplate("local");
    const cloud = storeWithTemplate("cloud");

    const result = resolveHydratedStore({
      initialLocalStore: local,
      latestLocalStore: local,
      cloudStore: cloud,
      revisionAtCloudLoad: 0,
      currentRevision: 0,
    });

    expect(result.shouldHydrateReactState).toBe(true);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "cloud",
      "local",
    ]);
  });

  it("keeps latest local state when a local edit happens during async cloud hydration", () => {
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

    expect(result.shouldHydrateReactState).toBe(false);
    expect(result.mergedStore.templates.map((item) => item.id)).toEqual([
      "cloud",
      "latest",
    ]);
    expect(result.mergedStore.templates.map((item) => item.id)).not.toContain(
      "initial",
    );
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
});
