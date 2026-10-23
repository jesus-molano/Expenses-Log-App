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
const endpoint = "https://push.example.test/device";

function internet(overrides: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
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

function reminderStore(templates: ExpenseTemplate[] = [internet()]): ExpenseStore {
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

function cronRequest() {
  return new Request("http://localhost/api/push/daily-reminders", {
    headers: { authorization: "Bearer cron-secret" },
  });
}

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number;
};

type Mutation = { table: string; action: "delete" | "update"; values?: unknown; filters: Record<string, unknown> };

function mockAdmin(options?: {
  abandonedClaimAgeMs?: number;
  stores?: Array<{ user_id: string; store: unknown }>;
  subscriptions?: SubscriptionRow[];
  failClaimFor?: string;
}) {
  type Claim = {
    claimedAt: number;
    status: "claimed" | "delivered";
    token: string;
  };

  const claims = new Map<string, Claim>();
  const mutations: Mutation[] = [];
  let tokenSequence = 1;
  let shouldSeedAbandonedClaim = Boolean(options?.abandonedClaimAgeMs);
  const nextToken = () =>
    `00000000-0000-4000-8000-${String(tokenSequence++).padStart(12, "0")}`;
  const claimKey = (key: string, kind: string, user: string) => `${user}|${kind}|${key}`;
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
      if (args.p_user_id === options?.failClaimFor) {
        return { data: null, error: { code: "XX000", message: "boom" } };
      }
      const key = claimKey(args.p_reminder_key, args.p_kind, args.p_user_id);
      if (shouldSeedAbandonedClaim) {
        claims.set(key, {
          claimedAt: Date.now() - (options?.abandonedClaimAgeMs ?? 0),
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
      const key = claimKey(
        String(filters.reminder_key),
        String(filters.kind),
        String(filters.user_id),
      );
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
        onFulfilled: (result: { error: null }) => unknown,
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
      options?.stores ?? [{ user_id: userId, store: reminderStore() }],
    ),
    push_subscriptions: table(
      "push_subscriptions",
      options?.subscriptions ?? [{ user_id: userId, endpoint, p256dh: "key", auth: "auth" }],
    ),
    push_reminder_deliveries: table("push_reminder_deliveries"),
  };
  const admin = {
    rpc,
    from: vi.fn((name: string) => tables[name]),
  };
  vi.mocked(createSupabaseServiceClient).mockReturnValue(admin as never);
  return { claims, rpc, mutations, tables };
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(webpush.sendNotification).mockReset().mockResolvedValue(undefined as never);
});

describe("/api/push/daily-reminders", () => {
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

  it("claims each stage with its own kind and sends one notification per stage", async () => {
    vi.setSystemTime(new Date("2026-08-24T09:00:00.000Z"));
    const { rpc } = mockAdmin({
      stores: [
        {
          user_id: userId,
          store: reminderStore([
            internet(),
            internet({ id: "template-gym", name: "Gym", dueDay: 21, startDate: "2026-01-21" }),
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

  it("keeps sending to other users when one fails", async () => {
    const { claims } = mockAdmin({
      failClaimFor: userId,
      stores: [
        { user_id: userId, store: reminderStore() },
        { user_id: otherUserId, store: reminderStore() },
      ],
      subscriptions: [
        { user_id: userId, endpoint, p256dh: "key", auth: "auth" },
        { user_id: otherUserId, endpoint: `${endpoint}-2`, p256dh: "key", auth: "auth" },
      ],
    });

    const summary = await (await GET(cronRequest())).json();

    expect(summary).toMatchObject({ errors: 1, notificationsSent: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
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

  it("counts failures and prunes a subscription that keeps failing", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 403 });
    const counted = mockAdmin({
      subscriptions: [{ user_id: userId, endpoint, p256dh: "key", auth: "auth", failure_count: 1 }],
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
      subscriptions: [{ user_id: userId, endpoint, p256dh: "key", auth: "auth", failure_count: 4 }],
    });
    const summary = await (await GET(cronRequest())).json();

    expect(summary.invalidSubscriptionsRemoved).toBe(1);
    expect(pruned.mutations).toContainEqual(
      expect.objectContaining({ table: "push_subscriptions", action: "delete" }),
    );
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
      subscriptions: [{ user_id: userId, endpoint, p256dh: "key", auth: "auth", failure_count: 2 }],
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

  it("rejects calls without the cron secret", async () => {
    mockAdmin();
    const response = await GET(new Request("http://localhost/api/push/daily-reminders"));
    expect(response.status).toBe(401);
  });
});
