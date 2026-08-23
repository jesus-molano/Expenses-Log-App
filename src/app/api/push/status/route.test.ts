import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { POST } from "./route";

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const endpoint = "https://push.example.test/device";
const user = { id: "00000000-0000-4000-8000-000000000001" } as User;

function request(body: unknown) {
  return new Request("http://localhost/api/push/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function query(result: { data: unknown; error: unknown }) {
  const value = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.limit.mockReturnValue(value);
  return value;
}

function mockSupabase(options?: {
  subscription?: unknown;
  delivery?: unknown;
  currentUser?: User | null;
}) {
  const subscriptionQuery = query({
    data:
      options?.subscription === undefined
        ? { updated_at: "2026-08-23T10:00:00.000Z" }
        : options.subscription,
    error: null,
  });
  const deliveryQuery = query({
    data:
      options?.delivery === undefined
        ? { delivered_at: "2026-08-23T08:00:00.000Z" }
        : options.delivery,
    error: null,
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            options?.currentUser === undefined ? user : options.currentUser,
        },
        error: null,
      }),
    },
    from: vi.fn((table) =>
      table === "push_subscriptions" ? subscriptionQuery : deliveryQuery,
    ),
  } as unknown as AppSupabaseClient);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/push/status", () => {
  it("rejects an invalid endpoint", async () => {
    const response = await POST(request({ endpoint: "invalid" }));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports an unregistered local device", async () => {
    mockSupabase({ subscription: null });
    const response = await POST(request({ endpoint }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mode: "ready", registered: false });
  });

  it("returns registration and latest scheduled delivery", async () => {
    mockSupabase();
    const response = await POST(request({ endpoint }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mode: "ready",
      registered: true,
      subscriptionUpdatedAt: "2026-08-23T10:00:00.000Z",
      lastScheduledDeliveryAt: "2026-08-23T08:00:00.000Z",
    });
  });
});
