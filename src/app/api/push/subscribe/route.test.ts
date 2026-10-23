import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { DELETE, GET, POST } from "./route";

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const endpoint = "https://fcm.googleapis.com/fcm/send/device";
const user = { id: "00000000-0000-4000-8000-000000000001" } as User;
const keys = { p256dh: "key", auth: "auth" };

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function storedSubscriptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/old-${index}`,
    updated_at: `2026-10-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
  }));
}

function mockSupabase(
  options: {
    user?: User | null;
    stored?: Array<{ endpoint: string; updated_at: string }>;
    upsertError?: { code: string; message: string } | null;
    // Respuestas propias del upsert (p. ej. sin la migración de salud).
    upsert?: ReturnType<typeof vi.fn>;
    // Sin la migración de F0c-2 el RPC no existe y se usa el upsert.
    rpcError?: { code: string; message: string } | null;
  } = {},
) {
  const rpc = vi.fn().mockResolvedValue({
    data: null,
    error:
      options.rpcError === undefined
        ? { code: "PGRST202", message: "Could not find the function public.claim_push_subscription" }
        : options.rpcError,
  });
  const upsert =
    options.upsert ??
    vi.fn().mockResolvedValue({ error: options.upsertError ?? null });
  const deleteQuery = {
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: (value: { error: null }) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };
  deleteQuery.eq.mockReturnValue(deleteQuery);
  const selectQuery = {
    eq: vi.fn().mockResolvedValue({ data: options.stored ?? [], error: null }),
  };
  const from = vi.fn().mockReturnValue({
    upsert,
    select: vi.fn().mockReturnValue(selectQuery),
    delete: vi.fn().mockReturnValue(deleteQuery),
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? user : options.user },
        error: null,
      }),
    },
    from,
    rpc,
  } as unknown as AppSupabaseClient);
  return { upsert, deleteQuery, selectQuery, rpc };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/push/subscribe", () => {
  it("only exposes the public key when both VAPID keys exist", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await GET()).status).toBe(503);

    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ publicKey: "public-key" });
  });

  it("rejects invalid subscription payloads", async () => {
    const response = await POST(request("POST", { endpoint }));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    "https://push.example.test/device",
    "https://169.254.169.254/latest/meta-data",
    "http://fcm.googleapis.com/fcm/send/device",
  ])("rejects %s, which is not a browser push service", async (target) => {
    const response = await POST(request("POST", { endpoint: target, keys }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "PUSH_ENDPOINT_NOT_ALLOWED" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("keeps anonymous local mode when Supabase is absent", async () => {
    vi.mocked(createClient).mockResolvedValue(null);
    const response = await POST(request("POST", { endpoint, keys }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "demo" });
  });

  it("stores an authenticated device under its user and forgets past failures", async () => {
    const { upsert, deleteQuery } = mockSupabase();
    const response = await POST(request("POST", { endpoint, keys }));

    expect(response.status).toBe(200);
    expect(deleteQuery.in).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: user.id,
        endpoint,
        p256dh: "key",
        auth: "auth",
        failure_count: 0,
      }),
      { onConflict: "endpoint" },
    );
  });

  it("still saves the device before the health migration is applied", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "PGRST204" } })
      .mockResolvedValueOnce({ error: null });
    mockSupabase({ upsert });
    const response = await POST(request("POST", { endpoint, keys }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).not.toHaveProperty("failure_count");
  });

  it("replaces the previous endpoint of a renewed subscription", async () => {
    const previousEndpoint = "https://fcm.googleapis.com/fcm/send/old-device";
    const { deleteQuery } = mockSupabase();
    const response = await POST(
      request("POST", { endpoint, keys, previousEndpoint }),
    );

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", previousEndpoint);
  });

  it("does not evict another device for the endpoint a renewal replaces", async () => {
    const stored = storedSubscriptions(10);
    const { deleteQuery } = mockSupabase({ stored });
    const response = await POST(
      request("POST", { endpoint, keys, previousEndpoint: stored[0].endpoint }),
    );

    expect(response.status).toBe(200);
    expect(deleteQuery.in).not.toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", stored[0].endpoint);
  });

  it("removes the replaced endpoint before the claim RPC makes room", async () => {
    const stored = storedSubscriptions(10);
    const { deleteQuery, rpc } = mockSupabase({ stored, rpcError: null });
    const previousEndpoint = stored[9].endpoint;
    const response = await POST(request("POST", { endpoint, keys, previousEndpoint }));

    expect(response.status).toBe(200);
    // El RPC borra en la base de datos lo que pase de 10: la antigua tiene que
    // haberse ido ya para que no se lleve otro dispositivo.
    const removal = deleteQuery.eq.mock.calls.findIndex(
      ([column, value]) => column === "endpoint" && value === previousEndpoint,
    );
    expect(removal).toBeGreaterThanOrEqual(0);
    expect(deleteQuery.eq.mock.invocationCallOrder[removal]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(deleteQuery.in).not.toHaveBeenCalled();
  });

  it("replaces the least recently updated device beyond ten", async () => {
    const { upsert, deleteQuery } = mockSupabase({ stored: storedSubscriptions(10) });
    const response = await POST(request("POST", { endpoint, keys }));

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(deleteQuery.in).toHaveBeenCalledWith("endpoint", [
      "https://fcm.googleapis.com/fcm/send/old-0",
    ]);
    expect(upsert).toHaveBeenCalled();
  });

  it("refreshes an existing device without evicting others", async () => {
    const stored = storedSubscriptions(10);
    const { deleteQuery } = mockSupabase({ stored });
    const response = await POST(
      request("POST", { endpoint: stored[0].endpoint, keys }),
    );

    expect(response.status).toBe(200);
    expect(deleteQuery.in).not.toHaveBeenCalled();
  });

  it("reports an endpoint registered by another account as a conflict", async () => {
    const { deleteQuery } = mockSupabase({
      stored: storedSubscriptions(10),
      upsertError: {
        code: "42501",
        message: "new row violates row-level security policy",
      },
    });
    const response = await POST(request("POST", { endpoint, keys }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "PUSH_SUBSCRIPTION_IN_USE" });
    // Sin guardar el nuevo no se borra ningún dispositivo.
    expect(deleteQuery.in).not.toHaveBeenCalled();
  });

  it("claims the endpoint through the RPC once the migration exists", async () => {
    const { rpc, upsert } = mockSupabase({ rpcError: null });
    const response = await POST(
      request("POST", { endpoint, keys: { p256dh: "key", auth: "auth" } }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("claim_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "key",
      p_auth: "auth",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reports a failed claim without falling back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // 42501 se reserva para el endpoint de otra cuenta (409); cualquier otro
    // fallo del RPC es un error del guardado.
    const { upsert } = mockSupabase({
      rpcError: { code: "22023", message: "invalid push subscription" },
    });
    const response = await POST(
      request("POST", { endpoint, keys: { p256dh: "key", auth: "auth" } }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "PUSH_SUBSCRIPTION_SAVE_FAILED" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("removes only the authenticated user's endpoint", async () => {
    const { deleteQuery } = mockSupabase();
    const response = await DELETE(request("DELETE", { endpoint }));

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", endpoint);
  });

  it("can still remove a legacy endpoint from a host no longer accepted", async () => {
    const legacy = "https://push.example.test/device";
    const { deleteQuery } = mockSupabase();
    const response = await DELETE(request("DELETE", { endpoint: legacy }));

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", legacy);
  });
});
