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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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
    vi.clearAllMocks();
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
        onAuthStateChange: vi.fn().mockReturnValue({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
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
    expect(onHydrate).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        templates: [expect.objectContaining({ id: "initial" })],
      }),
    );
    expect(onPersist.mock.calls[0][0].templates.map((item: { id: string }) => item.id))
      .toEqual(["latest"]);
    expect(vi.mocked(saveCloudStore).mock.calls[0][2].templates.map((item) => item.id))
      .toEqual(["cloud", "latest"]);
  });

  it("hydrates cloud data when auth appears after local startup", async () => {
    let authHandler: ((event: string, session: { user: User } | null) => void) | null =
      null;
    let currentUser: User | null = null;
    const localStore = storeWithTemplate("local");
    const cloudStore = storeWithTemplate("cloud");
    const user = {
      id: "00000000-0000-4000-8000-000000000002",
    } as User;
    const supabase = {
      auth: {
        getUser: vi.fn().mockImplementation(() => Promise.resolve({
          data: { user: currentUser },
          error: null,
        })),
        onAuthStateChange: vi.fn().mockImplementation((handler) => {
          authHandler = handler;
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }),
      },
    } as unknown as AppSupabaseClient;
    const onHydrate = vi.fn();

    saveExpenseStore(localStore);
    vi.mocked(createClient).mockReturnValue(supabase);
    vi.mocked(loadCloudStore).mockResolvedValue({ store: cloudStore, mode: "table" });
    vi.mocked(saveCloudStore).mockResolvedValue({ mode: "table" });

    renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() =>
      expect(onHydrate).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaVersion: 2,
          templates: [expect.objectContaining({ id: "local" })],
        }),
      ),
    );

    act(() => {
      currentUser = user;
      authHandler?.("SIGNED_IN", { user });
    });

    await waitFor(() =>
      expect(onHydrate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          templates: [
            expect.objectContaining({
              id: "cloud",
            }),
          ],
        }),
      ),
    );

    expect(saveCloudStore).not.toHaveBeenCalled();
  });
});
