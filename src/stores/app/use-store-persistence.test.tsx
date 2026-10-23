import { act, renderHook, waitFor } from "@testing-library/react";
import { AuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import {
  EXPENSE_STORE_KEY,
  loadExpenseStore,
  saveExpenseStore,
} from "@/data/persistence/local-store";
import {
  loadCloudStore,
  saveCloudStore,
  type CloudStoreResult,
  type CloudStoreSaveResult,
} from "@/data/persistence/cloud-store";
import { readSyncMeta, writeSyncMeta } from "@/data/persistence/sync-meta-store";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { createClient } from "@/utils/supabase/client";
import { CLOUD_PULL_THROTTLE_MS } from "./sync-policy";
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

const stableOnHydrate = vi.fn();
const SAVED: CloudStoreSaveResult = { status: "saved", mode: "table", revision: 4 };

function templateIds(store: ExpenseStore) {
  return store.templates.map((item) => item.id);
}

function storeWithTemplates(...ids: string[]): ExpenseStore {
  return {
    ...emptyStore,
    templates: ids.flatMap((id) => storeWithTemplate(id).templates),
  };
}

// Otra pestaña escribe en el dispositivo y el navegador avisa a esta.
function writeFromOtherTab(store: ExpenseStore, { notify = true } = {}) {
  window.localStorage.setItem(EXPENSE_STORE_KEY, JSON.stringify(store));
  if (notify) {
    window.dispatchEvent(new StorageEvent("storage", { key: EXPENSE_STORE_KEY }));
  }
}

function returnToApp() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function savedTemplateIds(call: number) {
  return templateIds(vi.mocked(saveCloudStore).mock.calls[call][2]);
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
    const cloudLoad = deferred<CloudStoreResult>();
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
    vi.mocked(saveCloudStore).mockResolvedValue(SAVED);

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(loadCloudStore).toHaveBeenCalled());

    act(() => {
      result.current.persist(latestStore, onPersist);
    });

    cloudLoad.resolve({ store: cloudStore, mode: "table", revision: 3 });

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
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: cloudStore,
      mode: "table",
      revision: 3,
    });
    vi.mocked(saveCloudStore).mockResolvedValue(SAVED);

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
      revision: 3,
    });
    vi.mocked(saveCloudStore).mockResolvedValue(SAVED);
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
      revision: 3,
    });
    const onHydrate = vi.fn();

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(saveCloudStore).not.toHaveBeenCalled();
    expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["cloud"]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });

  it("after a failed save, merges with the cloud again instead of replaying the old copy", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000005" } as User;
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: storeWithTemplate("cloud"),
      mode: "table",
      revision: 3,
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

    // Mientras tanto otro dispositivo añadió algo a la nube.
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: {
        ...storeWithTemplate("cloud"),
        templates: [
          ...storeWithTemplate("cloud").templates,
          ...storeWithTemplate("laptop").templates,
        ],
      },
      mode: "table",
      revision: 3,
    });
    vi.mocked(saveCloudStore).mockResolvedValue(SAVED);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(loadCloudStore).toHaveBeenCalledTimes(2);
    expect(templateIds(vi.mocked(saveCloudStore).mock.lastCall![2])).toEqual([
      "cloud",
      "laptop",
      "paid",
    ]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });

  it("keeps changes pending when the cloud answers without the table", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000006" } as User;
    saveExpenseStore(storeWithTemplate("offline-edit"));
    writeSyncMeta({ ownerId: user.id, dirty: true });
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: null,
      mode: "unavailable",
      revision: null,
    });
    vi.mocked(saveCloudStore).mockResolvedValue({
      status: "saved",
      mode: "unavailable",
      revision: null,
    });

    const { result } = renderHook(() =>
      useStorePersistence({ onHydrate: stableOnHydrate }),
    );

    await waitFor(() => expect(saveCloudStore).toHaveBeenCalled());
    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(readSyncMeta().dirty).toBe(true);
  });

  it("never uploads another account's local data into a new account", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000007" } as User;
    saveExpenseStore(storeWithTemplate("previous-account"));
    writeSyncMeta({ ownerId: "00000000-0000-4000-8000-000000000098", dirty: true });
    vi.mocked(createClient).mockReturnValue(signedInClient(user));
    vi.mocked(loadCloudStore).mockResolvedValue({ store: null, mode: "table", revision: null });
    const onHydrate = vi.fn();

    const { result } = renderHook(() => useStorePersistence({ onHydrate }));

    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
    expect(saveCloudStore).not.toHaveBeenCalled();
    expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual([]);
    expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });
  });

  it("does not sign out when the initial session is empty because there is no network", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000008" } as User;
    let authHandler: ((event: string, session: { user: User } | null) => void) | null =
      null;
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser,
        onAuthStateChange: vi.fn().mockImplementation((handler) => {
          authHandler = handler;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    } as unknown as AppSupabaseClient);

    const { result } = renderHook(() =>
      useStorePersistence({ onHydrate: stableOnHydrate }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => authHandler?.("INITIAL_SESSION", null));
    act(() => {
      result.current.persist(storeWithTemplate("offline-edit"), vi.fn());
    });

    // Sin cuenta conocida, el cambio queda pendiente para la primera que entre.
    expect(readSyncMeta()).toMatchObject({ ownerId: null, dirty: true });

    getUser.mockResolvedValue({ data: { user }, error: null });
    vi.mocked(loadCloudStore).mockResolvedValue({
      store: storeWithTemplate("cloud"),
      mode: "table",
      revision: 3,
    });
    vi.mocked(saveCloudStore).mockResolvedValue(SAVED);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(saveCloudStore).toHaveBeenCalled());
    expect(templateIds(vi.mocked(saveCloudStore).mock.lastCall![2])).toEqual([
      "cloud",
      "offline-edit",
    ]);
  });

  describe("multi-device sync", () => {
    const user = { id: "00000000-0000-4000-8000-000000000010" } as User;

    async function renderSignedIn(cloud: CloudStoreResult) {
      vi.mocked(createClient).mockReturnValue(signedInClient(user));
      vi.mocked(loadCloudStore).mockResolvedValue(cloud);
      vi.mocked(saveCloudStore).mockResolvedValue(SAVED);
      const onHydrate = vi.fn();
      const rendered = renderHook(() => useStorePersistence({ onHydrate }));
      await waitFor(() => expect(rendered.result.current.syncStatus).toBe("synced"));
      return { ...rendered, onHydrate };
    }

    it("saves on top of the cloud revision it loaded", async () => {
      saveExpenseStore(storeWithTemplate("offline-edit"));
      writeSyncMeta({ ownerId: user.id, dirty: true });

      await renderSignedIn({ store: storeWithTemplate("cloud"), mode: "table", revision: 3 });

      expect(vi.mocked(saveCloudStore).mock.calls[0][3]).toBe(3);
      expect(readSyncMeta().dirty).toBe(false);
    });

    it("merges with the newer cloud and retries when another device saved first", async () => {
      const { result, onHydrate } = await renderSignedIn({
        store: storeWithTemplate("cloud"),
        mode: "table",
        revision: 3,
      });

      // El portátil guardó mientras tanto: el CAS de este dispositivo choca.
      vi.mocked(saveCloudStore)
        .mockResolvedValueOnce({ status: "conflict", revision: 5 })
        .mockResolvedValue({ status: "saved", mode: "table", revision: 6 });
      vi.mocked(loadCloudStore).mockResolvedValue({
        store: storeWithTemplates("cloud", "laptop"),
        mode: "table",
        revision: 5,
      });
      act(() => {
        result.current.persist(storeWithTemplates("cloud", "phone"), vi.fn());
        window.dispatchEvent(new Event("pagehide"));
      });

      await waitFor(() => expect(saveCloudStore).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
      expect(vi.mocked(saveCloudStore).mock.calls[0][3]).toBe(3);
      expect(vi.mocked(saveCloudStore).mock.calls[1][3]).toBe(5);
      expect(savedTemplateIds(1)).toEqual(["cloud", "laptop", "phone"]);
      expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["cloud", "laptop", "phone"]);
      expect(templateIds(loadExpenseStore())).toEqual(["cloud", "laptop", "phone"]);
      expect(readSyncMeta()).toMatchObject({ ownerId: user.id, dirty: false });

      // El siguiente guardado parte de la revisión que confirmó la nube.
      act(() => {
        result.current.persist(storeWithTemplates("cloud", "laptop", "phone", "next"), vi.fn());
        window.dispatchEvent(new Event("pagehide"));
      });
      await waitFor(() => expect(saveCloudStore).toHaveBeenCalledTimes(3));
      expect(vi.mocked(saveCloudStore).mock.calls[2][3]).toBe(6);
    });

    it("keeps working before the migration, without revisions", async () => {
      saveExpenseStore(storeWithTemplate("offline-edit"));
      writeSyncMeta({ ownerId: user.id, dirty: true });
      vi.mocked(createClient).mockReturnValue(signedInClient(user));
      vi.mocked(loadCloudStore).mockResolvedValue({
        store: storeWithTemplate("cloud"),
        mode: "table",
        revision: null,
      });
      vi.mocked(saveCloudStore).mockResolvedValue({
        status: "saved",
        mode: "table",
        revision: null,
      });

      const { result } = renderHook(() => useStorePersistence({ onHydrate: stableOnHydrate }));

      await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
      expect(vi.mocked(saveCloudStore).mock.calls[0][3]).toBeNull();
      expect(savedTemplateIds(0)).toEqual(["cloud", "offline-edit"]);
      expect(readSyncMeta().dirty).toBe(false);
    });

    it("pulls changes from other devices when returning to the app", async () => {
      const { result, onHydrate } = await renderSignedIn({
        store: storeWithTemplate("cloud"),
        mode: "table",
        revision: 3,
      });
      const now = Date.now();
      vi.mocked(loadCloudStore).mockResolvedValue({
        store: storeWithTemplates("cloud", "laptop"),
        mode: "table",
        revision: 4,
      });

      // Recién sincronizado: volver a la app no vuelve a pedir la nube.
      act(() => returnToApp());
      expect(loadCloudStore).toHaveBeenCalledTimes(1);

      vi.spyOn(Date, "now").mockReturnValue(now + CLOUD_PULL_THROTTLE_MS + 1);
      act(() => returnToApp());

      await waitFor(() =>
        expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["cloud", "laptop"]),
      );
      expect(loadCloudStore).toHaveBeenCalledTimes(2);
      expect(saveCloudStore).not.toHaveBeenCalled();
      expect(result.current.syncMessage).toBe(
        "Sincronizado · con cambios de otro dispositivo",
      );
      expect(templateIds(loadExpenseStore())).toEqual(["cloud", "laptop"]);
    });

    it("does not rehydrate when the cloud revision has not changed", async () => {
      const { onHydrate } = await renderSignedIn({
        store: storeWithTemplate("cloud"),
        mode: "table",
        revision: 3,
      });
      const hydrations = onHydrate.mock.calls.length;
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + CLOUD_PULL_THROTTLE_MS + 1);

      act(() => returnToApp());

      await waitFor(() => expect(loadCloudStore).toHaveBeenCalledTimes(2));
      expect(onHydrate).toHaveBeenCalledTimes(hydrations);
    });

    it("merges and uploads unsynced local changes found when pulling", async () => {
      const { onHydrate } = await renderSignedIn({
        store: storeWithTemplate("cloud"),
        mode: "table",
        revision: 3,
      });
      // Otra pestaña dejó cambios sin subir (el estado de sync es compartido).
      writeFromOtherTab(storeWithTemplates("cloud", "tab"), { notify: false });
      writeSyncMeta({ ownerId: user.id, dirty: true });
      vi.mocked(loadCloudStore).mockResolvedValue({
        store: storeWithTemplates("cloud", "laptop"),
        mode: "table",
        revision: 4,
      });
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + CLOUD_PULL_THROTTLE_MS + 1);

      act(() => returnToApp());

      await waitFor(() => expect(saveCloudStore).toHaveBeenCalled());
      expect(vi.mocked(saveCloudStore).mock.calls[0][3]).toBe(4);
      expect(savedTemplateIds(0)).toEqual(["cloud", "laptop", "tab"]);
      expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["cloud", "laptop", "tab"]);
    });
  });

  describe("between tabs", () => {
    beforeEach(() => {
      vi.mocked(createClient).mockReturnValue(null);
    });

    it("shows what another tab saved without writing it back", async () => {
      saveExpenseStore(storeWithTemplate("a"));
      const onHydrate = vi.fn();
      const { result } = renderHook(() => useStorePersistence({ onHydrate }));
      await waitFor(() => expect(result.current.isHydrated).toBe(true));

      const fromOtherTab = storeWithTemplates("a", "b");
      act(() => writeFromOtherTab(fromOtherTab));

      expect(templateIds(onHydrate.mock.lastCall?.[0])).toEqual(["a", "b"]);
      expect(window.localStorage.getItem(EXPENSE_STORE_KEY)).toBe(
        JSON.stringify(fromOtherTab),
      );

      // La siguiente edición de esta pestaña lleva lo de la otra.
      act(() => result.current.persist(storeWithTemplates("a", "b", "c"), vi.fn()));
      expect(templateIds(loadExpenseStore())).toEqual(["a", "b", "c"]);
    });

    it("does not lose another tab's save that arrives just before an edit", async () => {
      saveExpenseStore(storeWithTemplate("a"));
      const { result } = renderHook(() => useStorePersistence({ onHydrate: stableOnHydrate }));
      await waitFor(() => expect(result.current.isHydrated).toBe(true));

      // La otra pestaña guarda y esta edita antes de recibir el aviso.
      writeFromOtherTab(storeWithTemplates("a", "x"), { notify: false });
      const onPersist = vi.fn();
      act(() => result.current.persist(storeWithTemplates("a", "c"), onPersist));

      expect(templateIds(onPersist.mock.lastCall?.[0])).toEqual(["a", "x", "c"]);
      expect(templateIds(loadExpenseStore())).toEqual(["a", "x", "c"]);
    });

    it("ignores the data of another account written by another tab", async () => {
      saveExpenseStore(storeWithTemplate("mine"));
      writeSyncMeta({ ownerId: "00000000-0000-4000-8000-000000000001", dirty: false });
      const onHydrate = vi.fn();
      const { result } = renderHook(() => useStorePersistence({ onHydrate }));
      await waitFor(() => expect(result.current.isHydrated).toBe(true));
      const hydrations = onHydrate.mock.calls.length;

      writeSyncMeta({ ownerId: "00000000-0000-4000-8000-000000000002", dirty: false });
      act(() => writeFromOtherTab(storeWithTemplate("someone-else")));

      expect(onHydrate).toHaveBeenCalledTimes(hydrations);
    });

    it("ignores storage events for other keys", async () => {
      saveExpenseStore(storeWithTemplate("a"));
      const onHydrate = vi.fn();
      const { result } = renderHook(() => useStorePersistence({ onHydrate }));
      await waitFor(() => expect(result.current.isHydrated).toBe(true));
      const hydrations = onHydrate.mock.calls.length;

      window.localStorage.setItem(
        EXPENSE_STORE_KEY,
        JSON.stringify(storeWithTemplates("a", "b")),
      );
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: "expense-theme" }));
      });

      expect(onHydrate).toHaveBeenCalledTimes(hydrations);
    });
  });
});
