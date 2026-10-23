import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { GET } from "./route";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/data/supabase/admin-client", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

function reminderTemplate(overrides: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
  return {
    id: "template-internet",
    userId,
    name: "Internet",
    description: "Fibra",
    amount: 60,
    currency: "EUR",
    categoryId: "services",
    startDate: "2026-01-24",
    dueDay: 24,
    recurrence: { frequency: "monthly" },
    reminder: { enabled: true, daysBeforeCharge: 5 },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function reminderStore(templates = [reminderTemplate()]): ExpenseStore {
  return {
    schemaVersion: 3,
    categories: [],
    templates,
    overrides: [],
    finance: {
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets: {},
      monthlySavingsContributions: {},
    },
    preferences: { theme: "vice-afterglow", language: "es" },
  };
}

function subscriptionRow(user: string, endpoint: string, updatedAt = "2026-08-01T00:00:00.000Z") {
  return { user_id: user, endpoint, p256dh: "key", auth: "auth", updated_at: updatedAt };
}

function cronRequest(authorization = "Bearer cron-secret") {
  return new Request("http://localhost/api/push/daily-reminders", {
    headers: { authorization },
  });
}

type Claim = {
  claimedAt: number;
  status: "claimed" | "delivered";
  token: string;
};

type MockOptions = {
  abandonedClaimAgeMs?: number;
  stores?: Array<{ user_id: string; store: unknown }>;
  subscriptions?: ReturnType<typeof subscriptionRow>[];
  // Devuelve un error del RPC en la llamada n (empezando en 1) de ese usuario.
  rpcErrorFor?: { user: string; call: number };
  releaseError?: boolean;
};

function mockAtomicAdmin(options: MockOptions = {}) {
  const claims = new Map<string, Claim>();
  const rpcCalls = new Map<string, number>();
  let tokenSequence = 1;
  let shouldSeedAbandonedClaim = Boolean(options.abandonedClaimAgeMs);
  const nextToken = () =>
    `00000000-0000-4000-8000-${String(tokenSequence++).padStart(12, "0")}`;
  const claimKey = (user: unknown, reminderKey: unknown) =>
    `${String(user)}|${String(reminderKey)}`;

  const rpc = vi.fn(
    async (
      _name: string,
      args: {
        p_user_id: string;
        p_reminder_key: string;
        p_lease_seconds: number;
      },
    ) => {
      const call = (rpcCalls.get(args.p_user_id) ?? 0) + 1;
      rpcCalls.set(args.p_user_id, call);
      if (
        options.rpcErrorFor?.user === args.p_user_id &&
        options.rpcErrorFor.call === call
      ) {
        return { data: null, error: { code: "57014", message: "statement timeout" } };
      }

      const key = claimKey(args.p_user_id, args.p_reminder_key);
      if (shouldSeedAbandonedClaim) {
        claims.set(key, {
          claimedAt: Date.now() - (options.abandonedClaimAgeMs ?? 0),
          status: "claimed",
          token: "00000000-0000-4000-8000-000000000000",
        });
        shouldSeedAbandonedClaim = false;
      }

      const existing = claims.get(key);
      const leaseExpired =
        existing?.status === "claimed" &&
        Date.now() - existing.claimedAt > args.p_lease_seconds * 1000;
      if (existing && !leaseExpired) return { data: null, error: null };

      const token = nextToken();
      claims.set(key, { claimedAt: Date.now(), status: "claimed", token });
      return { data: token, error: null };
    },
  );
  const stores = {
    select: vi.fn().mockResolvedValue({
      data: options.stores ?? [{ user_id: userId, store: reminderStore() }],
      error: null,
    }),
  };
  const removedEndpoints: string[] = [];
  const subscriptions = {
    select: vi.fn().mockResolvedValue({
      data: options.subscriptions ?? [
        subscriptionRow(userId, "https://fcm.googleapis.com/fcm/send/device"),
      ],
      error: null,
    }),
    delete: vi.fn(() => {
      const builder = {
        eq: vi.fn(() => builder),
        in: vi.fn(async (_column: string, values: string[]) => {
          removedEndpoints.push(...values);
          return { error: null };
        }),
      };
      return builder;
    }),
  };

  function mutation(
    action: "delete" | "update",
    values?: { status?: "delivered" },
  ) {
    const filters = new Map<string, unknown>();
    const execute = () => {
      if (action === "delete" && options.releaseError) {
        return { error: { code: "08006", message: "connection failure" } };
      }
      const key = claimKey(filters.get("user_id"), filters.get("reminder_key"));
      const claim = claims.get(key);
      if (
        claim &&
        claim.token === filters.get("claim_token") &&
        claim.status === filters.get("status")
      ) {
        if (action === "delete") claims.delete(key);
        if (action === "update" && values?.status === "delivered") {
          claims.set(key, { ...claim, status: "delivered" });
        }
      }
      return { error: null };
    };
    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters.set(column, value);
        return builder;
      }),
      then: (
        onFulfilled: (result: { error: unknown }) => unknown,
        onRejected?: (error: unknown) => unknown,
      ) => Promise.resolve(execute()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const deliveries = {
    delete: vi.fn(() => mutation("delete")),
    update: vi.fn((values: { status?: "delivered" }) =>
      mutation("update", values),
    ),
  };
  const admin = {
    rpc,
    from: vi.fn((table: string) => {
      if (table === "app_stores") return stores;
      if (table === "push_subscriptions") return subscriptions;
      return deliveries;
    }),
  };
  vi.mocked(createSupabaseServiceClient).mockReturnValue(admin as never);
  return { claims, rpc, removedEndpoints };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
  vi.mocked(webpush.sendNotification).mockResolvedValue({
    statusCode: 201,
    body: "",
    headers: {},
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/push/daily-reminders", () => {
  it("rejects a wrong secret, also with the same length", async () => {
    mockAtomicAdmin();

    expect((await GET(cronRequest("Bearer cron-secreT"))).status).toBe(401);
    expect((await GET(cronRequest("Bearer nope"))).status).toBe(401);
    expect((await GET(cronRequest(""))).status).toBe(401);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("claims an occurrence atomically across concurrent cron calls", async () => {
    const { claims, rpc } = mockAtomicAdmin();

    const responses = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const summaries = await Promise.all(responses.map((response) => response.json()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(
      summaries.reduce(
        (total, summary) => total + summary.duplicateDeliveriesSkipped,
        0,
      ),
    ).toBe(1);
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({ status: "delivered" }),
    ]);
  });

  it("reclaims an abandoned lease after a crashed cron execution", async () => {
    const { claims, rpc } = mockAtomicAdmin({
      abandonedClaimAgeMs: 16 * 60 * 1000,
    });

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary.duplicateDeliveriesSkipped).toBe(0);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "claim_push_reminder_delivery",
      expect.objectContaining({ p_lease_seconds: 15 * 60 }),
    );
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({
        status: "delivered",
        token: "00000000-0000-4000-8000-000000000001",
      }),
    ]);
  });

  it("sends with a socket timeout and a one-day TTL", async () => {
    mockAtomicAdmin();

    await GET(cronRequest());

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/device",
        keys: { p256dh: "key", auth: "auth" },
      },
      expect.stringContaining("Internet"),
      { TTL: 24 * 60 * 60, timeout: 5000 },
    );
  });

  it("skips a malformed store and still reminds the next user", async () => {
    mockAtomicAdmin({
      stores: [
        { user_id: userId, store: { templates: "broken", overrides: null } },
        { user_id: otherUserId, store: reminderStore() },
      ],
      subscriptions: [
        subscriptionRow(userId, "https://fcm.googleapis.com/fcm/send/broken"),
        subscriptionRow(otherUserId, "https://fcm.googleapis.com/fcm/send/ok"),
      ],
    });

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary).toMatchObject({
      invalidStoresSkipped: 1,
      usersWithReminders: 1,
      notificationsSent: 1,
      errors: 0,
    });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/fcm/send/ok" }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it("ignores broken templates and overrides instead of aborting", async () => {
    const store = reminderStore([
      { ...reminderTemplate({ id: "broken" }), recurrence: null } as unknown as ExpenseTemplate,
      reminderTemplate({ id: "bad-date", startDate: "2026-02-31x" }),
      reminderTemplate(),
    ]);
    store.overrides = [
      {
        id: "ovr:template-internet:2026-08-24",
        userId,
        templateId: "template-internet",
        occurrenceDate: "2026-08-24",
        status: "due",
        dueDate: "not-a-date",
      },
    ];
    mockAtomicAdmin({ stores: [{ user_id: userId, store }] });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ notificationsSent: 1, errors: 0 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("counts an RPC error for one user, releases its leases and goes on", async () => {
    const { claims } = mockAtomicAdmin({
      stores: [
        {
          user_id: userId,
          store: reminderStore([
            reminderTemplate({ id: "internet", name: "Internet" }),
            reminderTemplate({ id: "phone", name: "Teléfono" }),
          ]),
        },
        { user_id: otherUserId, store: reminderStore() },
      ],
      subscriptions: [
        subscriptionRow(userId, "https://fcm.googleapis.com/fcm/send/one"),
        subscriptionRow(otherUserId, "https://fcm.googleapis.com/fcm/send/two"),
      ],
      // El segundo recibo del primer usuario falla después de reclamar el primero.
      rpcErrorFor: { user: userId, call: 2 },
    });

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary).toMatchObject({ errors: 1, notificationsSent: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(
      Array.from(claims.keys()).filter((key) => key.startsWith(userId)),
    ).toEqual([]);
    expect(
      Array.from(claims.entries()).filter(([key]) => key.startsWith(otherUserId)),
    ).toEqual([[expect.any(String), expect.objectContaining({ status: "delivered" })]]);
  });

  it("counts a lease that could not be released as an error", async () => {
    mockAtomicAdmin({ releaseError: true });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
      Object.assign(new Error("Socket timeout"), { statusCode: undefined }),
    );

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary).toMatchObject({ notificationsFailed: 1, errors: 1 });
  });

  it("never sends to endpoints outside the push services", async () => {
    mockAtomicAdmin({
      subscriptions: [
        subscriptionRow(userId, "https://169.254.169.254/latest/meta-data"),
        subscriptionRow(userId, "https://push.example.test/device"),
      ],
    });

    const summary = await (await GET(cronRequest())).json();

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ blockedEndpointsSkipped: 2, usersWithReminders: 0 });
  });

  it("sends to every device at once and prunes the expired ones", async () => {
    const { claims, removedEndpoints } = mockAtomicAdmin({
      subscriptions: [
        subscriptionRow(userId, "https://fcm.googleapis.com/fcm/send/gone"),
        subscriptionRow(userId, "https://updates.push.services.mozilla.com/wpush/v2/ok"),
      ],
    });
    vi.mocked(webpush.sendNotification).mockImplementation(async (subscription) => {
      if (subscription.endpoint.endsWith("/gone")) {
        throw Object.assign(new Error("Gone"), { statusCode: 410 });
      }
      return { statusCode: 201, body: "", headers: {} };
    });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({
      notificationsSent: 1,
      notificationsFailed: 1,
      invalidSubscriptionsRemoved: 1,
      errors: 0,
    });
    expect(removedEndpoints).toEqual(["https://fcm.googleapis.com/fcm/send/gone"]);
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({ status: "delivered" }),
    ]);
  });

  it("sends to at most ten devices per user, the most recent ones", async () => {
    mockAtomicAdmin({
      subscriptions: Array.from({ length: 12 }, (_, index) =>
        subscriptionRow(
          userId,
          `https://fcm.googleapis.com/fcm/send/${index}`,
          `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        ),
      ),
    });

    await GET(cronRequest());

    const endpoints = vi
      .mocked(webpush.sendNotification)
      .mock.calls.map(([subscription]) => subscription.endpoint);
    expect(endpoints).toHaveLength(10);
    expect(endpoints).not.toContain("https://fcm.googleapis.com/fcm/send/0");
    expect(endpoints).not.toContain("https://fcm.googleapis.com/fcm/send/1");
  });
});
