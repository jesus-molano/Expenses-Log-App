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
  } = {},
) {
  const upsert = vi
    .fn()
    .mockResolvedValue({ error: options.upsertError ?? null });
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
  } as unknown as AppSupabaseClient);
  return { upsert, deleteQuery, selectQuery };
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

  it("stores an authenticated device under its user", async () => {
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
      }),
      { onConflict: "endpoint" },
    );
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
