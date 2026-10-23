import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { emptyStore } from "@/domain/seed";
import {
  SAVE_RPC_RETRY_MS,
  isMissingAppStoresError,
  loadCloudStore,
  resetCloudStoreCapabilities,
  saveCloudStore,
} from "./cloud-store";

const user = { id: "00000000-0000-4000-8000-000000000001" } as User;
type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

const MISSING_RPC = {
  code: "PGRST202",
  message:
    "Could not find the function public.save_app_store(p_expected_revision, p_store) in the schema cache",
};

function mockSupabase({
  load = { data: null, error: null },
  rpc = [],
  upsert = { data: null, error: null },
}: {
  load?: QueryResult;
  rpc?: QueryResult[];
  upsert?: QueryResult;
} = {}) {
  const rpcResults = [...rpc];
  const calls = {
    select: vi.fn(),
    rpc: vi.fn(),
    upsert: vi.fn(),
  };
  const client = {
    from: vi.fn(() => ({
      select: (columns: string) => {
        calls.select(columns);
        const query = {
          eq: () => query,
          abortSignal: () => query,
          maybeSingle: () => Promise.resolve(load),
        };
        return query;
      },
      upsert: (row: unknown) => {
        calls.upsert(row);
        return { abortSignal: () => Promise.resolve(upsert) };
      },
    })),
    rpc: (name: string, args: unknown) => {
      calls.rpc(name, args);
      const result = rpcResults.shift() ?? { data: null, error: null };
      return { abortSignal: () => Promise.resolve(result) };
    },
  } as unknown as AppSupabaseClient;
  return { client, calls };
}

describe("cloud store", () => {
  beforeEach(() => {
    resetCloudStoreCapabilities();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("loadCloudStore", () => {
    it("returns the row revision for compare-and-swap", async () => {
      const { client, calls } = mockSupabase({
        load: { data: { store: emptyStore, revision: 7 }, error: null },
      });

      const result = await loadCloudStore(client, user);

      expect(calls.select).toHaveBeenCalledWith("*");
      expect(result).toMatchObject({ mode: "table", revision: 7 });
      expect(result.store?.schemaVersion).toBe(3);
    });

    it("loads before the migration, when the row has no revision column", async () => {
      const { client } = mockSupabase({
        load: { data: { store: emptyStore }, error: null },
      });

      await expect(loadCloudStore(client, user)).resolves.toMatchObject({
        mode: "table",
        revision: null,
      });
    });

    it("has no revision when the account has no row yet", async () => {
      const { client } = mockSupabase();

      await expect(loadCloudStore(client, user)).resolves.toEqual({
        store: null,
        mode: "table",
        revision: null,
      });
    });

    it("degrades to local mode only when the table does not exist", async () => {
      const missingTable = mockSupabase({
        load: { data: null, error: { code: "PGRST205", message: "missing" } },
      });
      await expect(loadCloudStore(missingTable.client, user)).resolves.toMatchObject({
        mode: "unavailable",
      });

      const denied = mockSupabase({
        load: { data: null, error: { code: "42501", message: "denied" } },
      });
      await expect(loadCloudStore(denied.client, user)).rejects.toMatchObject({
        code: "42501",
      });
    });
  });

  describe("saveCloudStore", () => {
    it("saves through the CAS RPC with the expected revision", async () => {
      const { client, calls } = mockSupabase({
        rpc: [{ data: { status: "saved", revision: 4 }, error: null }],
      });

      const result = await saveCloudStore(client, user, emptyStore, 3);

      expect(result).toEqual({ status: "saved", mode: "table", revision: 4 });
      expect(calls.rpc).toHaveBeenCalledWith("save_app_store", {
        p_store: expect.objectContaining({ schemaVersion: 3 }),
        p_expected_revision: 3,
      });
      expect(calls.upsert).not.toHaveBeenCalled();
    });

    it("asks to create the row when no revision is known", async () => {
      const { client, calls } = mockSupabase({
        rpc: [{ data: { status: "saved", revision: 0 }, error: null }],
      });

      await saveCloudStore(client, user, emptyStore);

      expect(calls.rpc).toHaveBeenCalledWith(
        "save_app_store",
        expect.objectContaining({ p_expected_revision: null }),
      );
    });

    it("reports a conflict with the cloud revision instead of overwriting", async () => {
      const { client, calls } = mockSupabase({
        rpc: [{ data: { status: "conflict", revision: 9 }, error: null }],
      });

      await expect(saveCloudStore(client, user, emptyStore, 3)).resolves.toEqual({
        status: "conflict",
        revision: 9,
      });
      expect(calls.upsert).not.toHaveBeenCalled();
    });

    it("reports a conflict without revision when the row is gone", async () => {
      const { client } = mockSupabase({
        rpc: [{ data: { status: "conflict", revision: null }, error: null }],
      });

      await expect(saveCloudStore(client, user, emptyStore, 3)).resolves.toEqual({
        status: "conflict",
        revision: null,
      });
    });

    it("falls back to the plain upsert once and logs it when the RPC is missing", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { client, calls } = mockSupabase({ rpc: [{ data: null, error: MISSING_RPC }] });

      await expect(saveCloudStore(client, user, emptyStore, 2)).resolves.toEqual({
        status: "saved",
        mode: "table",
        revision: null,
      });
      expect(calls.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: user.id }),
      );

      // Mientras tanto no vuelve a probar el RPC ni a registrar el aviso.
      await saveCloudStore(client, user, emptyStore, null);
      expect(calls.rpc).toHaveBeenCalledTimes(1);
      expect(calls.upsert).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("tries the RPC again once the migration may have been applied", async () => {
      vi.useFakeTimers();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { client, calls } = mockSupabase({
        rpc: [
          { data: null, error: MISSING_RPC },
          { data: { status: "saved", revision: 0 }, error: null },
        ],
      });

      await saveCloudStore(client, user, emptyStore);
      vi.advanceTimersByTime(SAVE_RPC_RETRY_MS);
      const result = await saveCloudStore(client, user, emptyStore);

      expect(calls.rpc).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ status: "saved", mode: "table", revision: 0 });
    });

    it("keeps local mode when the table does not exist", async () => {
      const { client } = mockSupabase({
        rpc: [{ data: null, error: { code: "42P01", message: "relation missing" } }],
      });

      await expect(saveCloudStore(client, user, emptyStore)).resolves.toEqual({
        status: "saved",
        mode: "unavailable",
        revision: null,
      });
    });

    it("throws other RPC errors so the sync retries", async () => {
      const { client, calls } = mockSupabase({
        rpc: [{ data: null, error: { code: "42501", message: "permission denied" } }],
      });

      await expect(saveCloudStore(client, user, emptyStore, 1)).rejects.toMatchObject({
        code: "42501",
      });
      expect(calls.upsert).not.toHaveBeenCalled();
    });

    it("rejects an unexpected RPC response", async () => {
      const { client } = mockSupabase({
        rpc: [{ data: { status: "saved" }, error: null }],
      });

      await expect(saveCloudStore(client, user, emptyStore, 1)).rejects.toThrow(
        "Unexpected save_app_store response.",
      );
    });
  });

  it("never treats a missing CAS RPC as a missing cloud", () => {
    expect(isMissingAppStoresError(MISSING_RPC)).toBe(false);
    expect(isMissingAppStoresError({ message: MISSING_RPC.message })).toBe(false);
    expect(isMissingAppStoresError({ code: "PGRST205", message: "" })).toBe(true);
    expect(
      isMissingAppStoresError({ message: 'relation "public.app_stores" does not exist' }),
    ).toBe(true);
    expect(isMissingAppStoresError({ code: "PGRST002", message: "schema cache" })).toBe(
      false,
    );
  });
});
