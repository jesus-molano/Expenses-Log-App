import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { DELETE, GET, POST } from "./route";

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const endpoint = "https://push.example.test/device";
const user = { id: "00000000-0000-4000-8000-000000000001" } as User;

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSupabase(
  currentUser: User | null = user,
  upsert = vi.fn().mockResolvedValue({ error: null }),
) {
  const deleteQuery = { eq: vi.fn() };
  deleteQuery.eq.mockReturnValue(deleteQuery);
  const from = vi.fn().mockReturnValue({
    upsert,
    delete: vi.fn().mockReturnValue(deleteQuery),
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: null,
      }),
    },
    from,
  } as unknown as AppSupabaseClient);
  return { upsert, deleteQuery };
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

  it("keeps anonymous local mode when Supabase is absent", async () => {
    vi.mocked(createClient).mockResolvedValue(null);
    const response = await POST(
      request("POST", { endpoint, keys: { p256dh: "key", auth: "auth" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "demo" });
  });

  it("stores an authenticated device under its user and forgets past failures", async () => {
    const { upsert } = mockSupabase();
    const response = await POST(
      request("POST", { endpoint, keys: { p256dh: "key", auth: "auth" } }),
    );

    expect(response.status).toBe(200);
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
    mockSupabase(user, upsert);
    const response = await POST(
      request("POST", { endpoint, keys: { p256dh: "key", auth: "auth" } }),
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).not.toHaveProperty("failure_count");
  });

  it("replaces the previous endpoint of a renewed subscription", async () => {
    const { deleteQuery } = mockSupabase();
    const response = await POST(
      request("POST", {
        endpoint,
        keys: { p256dh: "key", auth: "auth" },
        previousEndpoint: "https://push.example.test/old-device",
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(deleteQuery.eq).toHaveBeenCalledWith(
      "endpoint",
      "https://push.example.test/old-device",
    );
  });

  it("removes only the authenticated user's endpoint", async () => {
    const { deleteQuery } = mockSupabase();
    const response = await DELETE(request("DELETE", { endpoint }));

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", endpoint);
  });
});
