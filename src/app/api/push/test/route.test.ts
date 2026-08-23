import type { User } from "@supabase/supabase-js";
import webpush from "web-push";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { POST } from "./route";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const endpoint = "https://push.example.test/subscription";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
} as User;

function pushTestRequest(body: unknown) {
  return new Request("http://localhost/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSupabase(options?: {
  user?: User | null;
  subscription?: { endpoint: string; p256dh: string; auth: string } | null;
  subscriptionError?: unknown;
}) {
  const selectQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data:
        options?.subscription === undefined
          ? { endpoint, p256dh: "stored-p256dh", auth: "stored-auth" }
          : options.subscription,
      error: options?.subscriptionError ?? null,
    }),
  };
  selectQuery.eq.mockReturnValue(selectQuery);

  const deleteQuery = { eq: vi.fn() };
  deleteQuery.eq.mockReturnValue(deleteQuery);

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options?.user === undefined ? user : options.user },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectQuery),
      delete: vi.fn().mockReturnValue(deleteQuery),
    }),
  } as unknown as AppSupabaseClient;

  vi.mocked(createClient).mockResolvedValue(supabase);
  return { selectQuery, deleteQuery };
}

describe("/api/push/test", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects invalid endpoints before checking auth", async () => {
    const response = await POST(pushTestRequest({ endpoint: "not-a-url" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Suscripción push inválida." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("requires configured authentication", async () => {
    vi.mocked(createClient).mockResolvedValue(null);

    const response = await POST(pushTestRequest({ endpoint }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "AUTH_NOT_CONFIGURED" });
  });

  it("requires an authenticated user", async () => {
    mockSupabase({ user: null });

    const response = await POST(pushTestRequest({ endpoint }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHENTICATED" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("does not send to an endpoint that does not belong to the user", async () => {
    mockSupabase({ subscription: null });

    const response = await POST(pushTestRequest({ endpoint }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "PUSH_SUBSCRIPTION_NOT_FOUND" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("reports missing VAPID configuration", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    mockSupabase();

    const response = await POST(pushTestRequest({ endpoint }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "PUSH_NOT_CONFIGURED" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("uses the stored keys and ignores client-supplied keys", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    const { selectQuery } = mockSupabase();

    const response = await POST(
      pushTestRequest({ endpoint, keys: { p256dh: "forged", auth: "forged" } }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, sentAt: expect.any(String) });
    expect(selectQuery.eq).toHaveBeenCalledWith("endpoint", endpoint);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint,
        keys: { p256dh: "stored-p256dh", auth: "stored-auth" },
      },
      expect.any(String),
    );
  });

  it("removes an expired stored subscription", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    const { deleteQuery } = mockSupabase();
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });

    const response = await POST(pushTestRequest({ endpoint }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "PUSH_SUBSCRIPTION_EXPIRED" });
    expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", endpoint);
  });
});
