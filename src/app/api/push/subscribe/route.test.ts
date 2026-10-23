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
  rpcError: { code: string; message: string } | null = null,
) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
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
    rpc,
  } as unknown as AppSupabaseClient);
  return { upsert, rpc, deleteQuery };
}

afterEach(() => {
  vi.restoreAllMocks();
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

  it("claims the endpoint for the authenticated user", async () => {
    const { rpc, upsert } = mockSupabase();
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

  it("falls back to the direct upsert before the migration is applied", async () => {
    const { upsert } = mockSupabase(user, {
      code: "PGRST202",
      message: "Could not find the function public.claim_push_subscription",
    });
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
      }),
      { onConflict: "endpoint" },
    );
  });

  it("reports a failed claim without falling back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { upsert } = mockSupabase(user, {
      code: "42501",
      message: "permission denied",
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
});
