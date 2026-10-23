import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { loadCloudStore, saveCloudStore } from "@/data/persistence/cloud-store";
import { readSyncMeta, writeSyncMeta } from "@/data/persistence/sync-meta-store";
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

function signedInClient(user: User) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  } as unknown as AppSupabaseClient;
}

function templateIds(store: ExpenseStore) {
  return store.templates.map((item) => item.id);
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

  it("opens with local data when the Supabase client cannot be created", async () => {
    const localStore = storeWithTemplate("local");
    const onHydrate = vi.fn();

    saveExpenseStore(localStore);
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("Invalid Supabase configuration");
    });

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(onHydrate).toHaveBeenCalledWith(
      expect.objectContaining({
        templates: [expect.objectContaining({ id: "local" })],
      }),
    );
    expect(result.current.syncStatus).toBe("local");
  });

  it("hydrates cloud data merged with local edits made while cloud loads", async () => {
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

    expect(onHydrate).toHaveBeenCalledTimes(2);
    expect(onHydrate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        schemaVersion: 3,
        templates: [expect.objectContaining({ id: "initial" })],
      }),
    );
    expect(onHydrate.mock.calls[1][0].templates.map((item: { id: string }) => item.id))
      .toEqual(["cloud", "latest"]);
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
          schemaVersion: 3,
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
  it("merges changes left unsynced by a previous session of the same account", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000003" } as User;
    saveExpenseStore(storeWithTemplate("paid-offline"));
    writeSyncMeta({ ownerId: user.id, dirty: true });
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: storeWithTemplate("cloud"),
      mode: "table",
    });
    vi.mocked(saveCloudStore).mockResolvedValue({ mode: "table" });
    const onHydrate = vi.fn();

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(templateIds(vi.mocked(saveCloudStore).mock.calls[0][2]))
      .toEqual(["cloud", "paid-offline"]);
    expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual([
      "cloud",
      "paid-offline",
    ]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });

  it("does not merge unsynced changes that belong to another account", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000004" } as User;
    saveExpenseStore(storeWithTemplate("someone-else"));
    writeSyncMeta({ ownerId: "00000000-0000-4000-8000-000000000099", dirty: true });
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: storeWithTemplate("cloud"),
      mode: "table",
    });
    const onHydrate = vi.fn();

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(saveCloudStore).not.toHaveBeenCalled();
    expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["cloud"]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });

  it("keeps a failed save pending and uploads it when the connection returns", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000005" } as User;
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: storeWithTemplate("cloud"),
      mode: "table",
    });
    const onHydrate = vi.fn();
    const { result } = renderHook(() => useStorePersistence({ onHydrate }));
    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));

    vi.mocked(saveCloudStore).mockRejectedValue(new TypeError("Failed to fetch"));
    act(() => {
      result.current.persist(storeWithTemplate("paid"), vi.fn());
    });
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: true });

    // Al ocultar la app se sube sin esperar al debounce.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await waitFor(() => expect(result.current.syncStatus).toBe("pending"));
    expect(saveCloudStore).toHaveBeenCalledTimes(1);
    expect(readSyncMeta().dirty).toBe(true);

    vi.mocked(saveCloudStore).mockResolvedValue({ mode: "table" });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(templateIds(vi.mocked(saveCloudStore).mock.lastCall![2])).toEqual([
      "paid",
    ]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });
});
