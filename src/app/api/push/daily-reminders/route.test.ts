import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
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
const endpoint = "https://fcm.googleapis.com/fcm/send/device";

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

function reminderStore(templates: ExpenseTemplate[] = [reminderTemplate()]): ExpenseStore {
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

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  updated_at: string;
  // Solo con la migración de salud aplicada.
  failure_count?: number;
};

function subscriptionRow(
  user: string,
  target: string,
  updatedAt = "2026-08-01T00:00:00.000Z",
): SubscriptionRow {
  return { user_id: user, endpoint: target, p256dh: "key", auth: "auth", updated_at: updatedAt };
}

function cronRequest(authorization: string | null = "Bearer cron-secret") {
  return new Request("http://localhost/api/push/daily-reminders", {
    headers: authorization === null ? {} : { authorization },
  });
}

type Mutation = {
  table: string;
  action: "delete" | "update";
  values?: unknown;
  filters: Record<string, unknown>;
};

type MockOptions = {
  abandonedClaimAgeMs?: number;
  stores?: Array<{ user_id: string; store: unknown }>;
  subscriptions?: SubscriptionRow[];
  // Todas las reclamaciones de ese usuario fallan.
  failClaimFor?: string;
  // Devuelve un error del RPC en la llamada n (empezando en 1) de ese usuario.
  rpcErrorFor?: { user: string; call: number };
  // Liberar una reclamación falla.
  releaseError?: boolean;
};

function mockAdmin(options: MockOptions = {}) {
  type Claim = {
    claimedAt: number;
    status: "claimed" | "delivered";
    token: string;
  };

  const claims = new Map<string, Claim>();
  const mutations: Mutation[] = [];
  const rpcCalls = new Map<string, number>();
  let tokenSequence = 1;
  let shouldSeedAbandonedClaim = Boolean(options.abandonedClaimAgeMs);
  const nextToken = () =>
    `00000000-0000-4000-8000-${String(tokenSequence++).padStart(12, "0")}`;
  const claimKey = (user: unknown, kind: unknown, key: unknown) =>
    `${String(user)}|${String(kind)}|${String(key)}`;
  const rpc = vi.fn(
    async (
      _name: string,
      args: {
        p_user_id: string;
        p_reminder_key: string;
        p_kind: string;
        p_lease_seconds: number;
      },
    ) => {
      const call = (rpcCalls.get(args.p_user_id) ?? 0) + 1;
      rpcCalls.set(args.p_user_id, call);
      if (args.p_user_id === options.failClaimFor) {
        return { data: null, error: { code: "XX000", message: "boom" } };
      }
      if (
        options.rpcErrorFor?.user === args.p_user_id &&
        options.rpcErrorFor.call === call
      ) {
        return { data: null, error: { code: "57014", message: "statement timeout" } };
      }

      const key = claimKey(args.p_user_id, args.p_kind, args.p_reminder_key);
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

  function mutation(table: string, action: "delete" | "update", values?: { status?: string }) {
    const filters: Record<string, unknown> = {};
    const execute = () => {
      mutations.push({ table, action, values, filters });
      if (table !== "push_reminder_deliveries") return { error: null };
      if (action === "delete" && options.releaseError) {
        return { error: { code: "08006", message: "connection failure" } };
      }
      const key = claimKey(filters.user_id, filters.kind, filters.reminder_key);
      const claim = claims.get(key);
      if (claim && claim.token === filters.claim_token && claim.status === filters.status) {
        if (action === "delete") claims.delete(key);
        if (action === "update" && values?.status === "delivered") {
          claims.set(key, { ...claim, status: "delivered" });
        }
      }
      return { error: null };
    };
    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      }),
      then: (
        onFulfilled: (result: { error: unknown }) => unknown,
        onRejected?: (error: unknown) => unknown,
      ) => Promise.resolve(execute()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const table = (name: string, rows?: unknown[]) => ({
    select: vi.fn().mockResolvedValue({ data: rows ?? [], error: null }),
    delete: vi.fn(() => mutation(name, "delete")),
    update: vi.fn((values: { status?: string }) => mutation(name, "update", values)),
  });
  const tables: Record<string, ReturnType<typeof table>> = {
    app_stores: table(
      "app_stores",
      options.stores ?? [{ user_id: userId, store: reminderStore() }],
    ),
    push_subscriptions: table(
      "push_subscriptions",
      options.subscriptions ?? [subscriptionRow(userId, endpoint)],
    ),
    push_reminder_deliveries: table("push_reminder_deliveries"),
  };
  const admin = {
    rpc,
    from: vi.fn((name: string) => tables[name]),
  };
  vi.mocked(createSupabaseServiceClient).mockReturnValue(admin as never);

  // Endpoints borrados de push_subscriptions (caducados o con demasiados fallos).
  const removedEndpoints = () =>
    mutations
      .filter((item) => item.table === "push_subscriptions" && item.action === "delete")
      .map((item) => item.filters.endpoint);

  return { claims, rpc, mutations, tables, removedEndpoints };
}

function sentPayloads() {
  return vi
    .mocked(webpush.sendNotification)
    .mock.calls.map(([, payload]) => JSON.parse(String(payload)) as Record<string, unknown>);
}

beforeEach(() => {
  vi.useFakeTimers();
  // Domingo 23 de agosto, 13:00 en Canarias.
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
  vi.mocked(webpush.sendNotification).mockReset();
});

describe("/api/push/daily-reminders", () => {
  it("rejects calls without the cron secret", async () => {
    mockAdmin();
    const response = await GET(cronRequest(null));
    expect(response.status).toBe(401);
  });

  it("rejects a wrong secret, also with the same length", async () => {
    mockAdmin();

    expect((await GET(cronRequest("Bearer cron-secreT"))).status).toBe(401);
    expect((await GET(cronRequest("Bearer nope"))).status).toBe(401);
    expect((await GET(cronRequest(""))).status).toBe(401);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("claims an occurrence atomically across concurrent cron calls", async () => {
    const { claims, rpc } = mockAdmin();

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
    const { claims, rpc } = mockAdmin({
      abandonedClaimAgeMs: 16 * 60 * 1000,
    });

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary.duplicateDeliveriesSkipped).toBe(0);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "claim_push_reminder_delivery",
      expect.objectContaining({ p_lease_seconds: 15 * 60, p_kind: "last_chance" }),
    );
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({
        status: "delivered",
        token: "00000000-0000-4000-8000-000000000001",
      }),
    ]);
  });

  it("sends with a socket timeout and the TTL of its kind", async () => {
    mockAdmin();

    await GET(cronRequest());

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint, keys: { p256dh: "key", auth: "auth" } },
      expect.stringContaining("Internet"),
      { TTL: 20 * 60 * 60, timeout: 5_000, urgency: "normal" },
    );
  });

  it("sends a localized notification with amount, deep link and TTL", async () => {
    mockAdmin();

    await GET(cronRequest());

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint, keys: { p256dh: "key", auth: "auth" } },
      expect.any(String),
      expect.objectContaining({ TTL: 20 * 60 * 60, timeout: 5_000 }),
    );
    expect(sentPayloads()[0]).toMatchObject({
      title: "Internet se cobra mañana",
      url: "/?occurrence=template-internet%3A2026-08-24",
      tag: "last_chance:template-internet:2026-08-24",
      lang: "es",
    });
    expect(String(sentPayloads()[0].body)).toMatch(/^60,00\s€ · lunes 24 ago\./);
  });

  it("waits until the hour chosen by the user", async () => {
    const { rpc } = mockAdmin({
      stores: [
        {
          user_id: userId,
          store: {
            ...reminderStore(),
            preferences: {
              theme: "vice-afterglow",
              language: "es",
              reminders: { ...DEFAULT_REMINDER_PREFERENCES, pushHour: 20 },
            },
          },
        },
      ],
    });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ ok: true, usersWithReminders: 0 });
    expect(rpc).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("follows the default reminder for an expense without its own", async () => {
    const withDefaults = (defaultEnabled: boolean) => {
      const template = reminderTemplate();
      delete template.reminder;
      return {
        ...reminderStore([template]),
        preferences: {
          theme: "vice-afterglow",
          language: "es",
          reminders: { ...DEFAULT_REMINDER_PREFERENCES, defaultEnabled },
        },
      };
    };

    mockAdmin({ stores: [{ user_id: userId, store: withDefaults(false) }] });
    expect(await (await GET(cronRequest())).json()).toMatchObject({ usersWithReminders: 0 });
    expect(webpush.sendNotification).not.toHaveBeenCalled();

    mockAdmin({ stores: [{ user_id: userId, store: withDefaults(true) }] });
    expect(await (await GET(cronRequest())).json()).toMatchObject({
      usersWithReminders: 1,
      notificationsSent: 1,
    });
    expect(sentPayloads()[0]).toMatchObject({ title: "Internet se cobra mañana" });
  });

  it("claims each stage with its own kind and sends one notification per stage", async () => {
    vi.setSystemTime(new Date("2026-08-24T09:00:00.000Z"));
    const { rpc } = mockAdmin({
      stores: [
        {
          user_id: userId,
          store: reminderStore([
            reminderTemplate(),
            reminderTemplate({
              id: "template-gym",
              name: "Gym",
              dueDay: 21,
              startDate: "2026-01-21",
            }),
          ]),
        },
      ],
    });

    await GET(cronRequest());

    expect(rpc.mock.calls.map(([, args]) => args.p_kind)).toEqual([
      "charge_check",
      "charge_day",
    ]);
    expect(sentPayloads().map((payload) => payload.title)).toEqual([
      "¿Se cobró Gym?",
      "Hoy se cobra Internet",
    ]);
  });

  it("skips a malformed store and still reminds the next user", async () => {
    mockAdmin({
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
    mockAdmin({ stores: [{ user_id: userId, store }] });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ notificationsSent: 1, errors: 0 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("keeps sending to other users when one fails", async () => {
    const { claims } = mockAdmin({
      failClaimFor: userId,
      stores: [
        { user_id: userId, store: reminderStore() },
        { user_id: otherUserId, store: reminderStore() },
      ],
      subscriptions: [
        subscriptionRow(userId, endpoint),
        subscriptionRow(otherUserId, `${endpoint}-2`),
      ],
    });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ errors: 1, notificationsSent: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({ status: "delivered" }),
    ]);
  });

  it("counts an RPC error for one user, releases its leases and goes on", async () => {
    const { claims } = mockAdmin({
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
    mockAdmin({ releaseError: true });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
      Object.assign(new Error("Socket timeout"), { statusCode: undefined }),
    );

    const response = await GET(cronRequest());
    const summary = await response.json();

    expect(response.status).toBe(200);
    expect(summary).toMatchObject({ notificationsFailed: 1, errors: 1 });
  });

  it("never sends to endpoints outside the push services", async () => {
    mockAdmin({
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
    const { claims, removedEndpoints } = mockAdmin({
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
    expect(removedEndpoints()).toEqual(["https://fcm.googleapis.com/fcm/send/gone"]);
    expect(Array.from(claims.values())).toEqual([
      expect.objectContaining({ status: "delivered" }),
    ]);
  });

  it("removes an expired subscription and releases the claim", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });
    const { claims, mutations } = mockAdmin();

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ notificationsFailed: 1, invalidSubscriptionsRemoved: 1 });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        table: "push_subscriptions",
        action: "delete",
        filters: { endpoint },
      }),
    );
    expect(claims.size).toBe(0);
  });

  it("sends to at most ten devices per user, the most recent ones", async () => {
    mockAdmin({
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

  it("counts failures and prunes a subscription that keeps failing", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 403 });
    const counted = mockAdmin({
      subscriptions: [{ ...subscriptionRow(userId, endpoint), failure_count: 1 }],
    });

    await GET(cronRequest());

    expect(counted.mutations).toContainEqual(
      expect.objectContaining({
        table: "push_subscriptions",
        action: "update",
        values: expect.objectContaining({ failure_count: 2 }),
      }),
    );

    const pruned = mockAdmin({
      subscriptions: [{ ...subscriptionRow(userId, endpoint), failure_count: 4 }],
    });
    const summary = await (await GET(cronRequest())).json();

    expect(summary.invalidSubscriptionsRemoved).toBe(1);
    expect(pruned.removedEndpoints()).toEqual([endpoint]);
  });

  it("does not track failures before the health migration exists", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 500 });
    const { mutations, claims } = mockAdmin();

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ notificationsFailed: 1, invalidSubscriptionsRemoved: 0 });
    expect(mutations.filter((item) => item.table === "push_subscriptions")).toEqual([]);
    expect(claims.size).toBe(0);
  });

  it("forgets past failures after a successful delivery", async () => {
    const { mutations } = mockAdmin({
      subscriptions: [{ ...subscriptionRow(userId, endpoint), failure_count: 2 }],
    });

    await GET(cronRequest());

    expect(mutations).toContainEqual(
      expect.objectContaining({
        table: "push_subscriptions",
        action: "update",
        values: expect.objectContaining({ failure_count: 0 }),
      }),
    );
  });
});
