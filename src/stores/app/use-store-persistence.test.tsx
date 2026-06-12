import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { createClient } from "@/utils/supabase/client";
import { useStorePersistence } from "./use-store-persistence";

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/data/persistence/cloud-store", () => ({
  loadCloudStore: vi.fn(),
  saveCloudStore: vi.fn(),
}));

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("useStorePersistence", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    window.localStorage.clear();
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("does not rehydrate stale initial state over local edits made while cloud loads", async () => {
    const initialStore = storeWithTemplate("initial");
    const latestStore = storeWithTemplate("latest");
    const cloudStore = storeWithTemplate("cloud");
    const cloudLoad = deferred<{ store: ExpenseStore; mode: "table" }>();
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
    } as User;
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    } as unknown as AppSupabaseClient;
    const onHydrate = vi.fn();
    const onPersist = vi.fn();

    saveExpenseStore(initialStore);
    vi.mocked(createClient).mockReturnValue(supabase);
    vi.mocked(loadCloudStore).mockReturnValue(cloudLoad.promise);
    vi.mocked(saveCloudStore).mockResolvedValue({ mode: "table" });

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(loadCloudStore).toHaveBeenCalled());

    act(() => {
      result.current.persist(latestStore, onPersist);
    });

    cloudLoad.resolve({ store: cloudStore, mode: "table" });

    await waitFor(() => expect(saveCloudStore).toHaveBeenCalled());

    expect(onHydrate).toHaveBeenCalledTimes(1);
    expect(onHydrate).toHaveBeenCalledWith(initialStore);
    expect(onPersist.mock.calls[0][0].templates.map((item: { id: string }) => item.id))
      .toEqual(["latest"]);
    expect(vi.mocked(saveCloudStore).mock.calls[0][2].templates.map((item) => item.id))
      .toEqual(["cloud", "latest"]);
  });
});
