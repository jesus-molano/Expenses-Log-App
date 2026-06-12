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

const validSubscription = {
  endpoint: "https://push.example.test/subscription",
  keys: {
    p256dh: "p256dh-key",
    auth: "auth-key",
  },
};

function pushTestRequest(body: unknown) {
  return new Request("http://localhost/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSupabaseUser(user: User | null) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as unknown as AppSupabaseClient;

  vi.mocked(createClient).mockResolvedValue(supabase);
}

describe("/api/push/test", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects invalid subscriptions before checking auth", async () => {
    const response = await POST(pushTestRequest({ endpoint: "not-a-url" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Suscripción push inválida.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mockSupabaseUser(null);

    const response = await POST(pushTestRequest(validSubscription));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe(
      "Inicia sesión para enviar una notificación de prueba.",
    );
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("keeps demo response for authenticated users when VAPID is missing", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    mockSupabaseUser({
      id: "00000000-0000-4000-8000-000000000001",
    } as User);

    const response = await POST(pushTestRequest(validSubscription));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      mode: "demo",
      message: "Configura VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY para envío real.",
    });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
