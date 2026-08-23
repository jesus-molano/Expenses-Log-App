import webpush from "web-push";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import type { ExpenseStore } from "@/domain/types";
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

function reminderStore(): ExpenseStore {
  return {
    schemaVersion: 3,
    categories: [],
    templates: [
      {
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
      },
    ],
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

function mockAtomicAdmin(options?: { abandonedClaimAgeMs?: number }) {
  type Claim = {
    claimedAt: number;
    status: "claimed" | "delivered";
    token: string;
  };

  const claims = new Map<string, Claim>();
  let tokenSequence = 1;
  let shouldSeedAbandonedClaim = Boolean(options?.abandonedClaimAgeMs);
  const nextToken = () =>
    `00000000-0000-4000-8000-${String(tokenSequence++).padStart(12, "0")}`;
  const rpc = vi.fn(
    async (
      _name: string,
      args: {
        p_reminder_key: string;
        p_lease_seconds: number;
      },
    ) => {
      if (shouldSeedAbandonedClaim) {
        claims.set(args.p_reminder_key, {
          claimedAt: Date.now() - (options?.abandonedClaimAgeMs ?? 0),
          status: "claimed",
          token: "00000000-0000-4000-8000-000000000000",
        });
        shouldSeedAbandonedClaim = false;
      }

      const existing = claims.get(args.p_reminder_key);
      const leaseExpired =
        existing?.status === "claimed" &&
        Date.now() - existing.claimedAt > args.p_lease_seconds * 1000;
      if (existing && !leaseExpired) return { data: null, error: null };

      const token = nextToken();
      claims.set(args.p_reminder_key, {
        claimedAt: Date.now(),
        status: "claimed",
        token,
      });
      return { data: token, error: null };
    },
  );
  const stores = {
    select: vi.fn().mockResolvedValue({
      data: [{ user_id: userId, store: reminderStore() }],
      error: null,
    }),
  };
  const subscriptions = {
    select: vi.fn().mockResolvedValue({
      data: [
        {
          user_id: userId,
          endpoint: "https://push.example.test/device",
          p256dh: "key",
          auth: "auth",
        },
      ],
      error: null,
    }),
  };

  function mutation(
    action: "delete" | "update",
    values?: { status?: "delivered" },
  ) {
    const filters = new Map<string, unknown>();
    const execute = () => {
      const reminderKey = String(filters.get("reminder_key"));
      const claim = claims.get(reminderKey);
      if (
        claim &&
        claim.token === filters.get("claim_token") &&
        claim.status === filters.get("status")
      ) {
        if (action === "delete") claims.delete(reminderKey);
        if (action === "update" && values?.status === "delivered") {
          claims.set(reminderKey, { ...claim, status: "delivered" });
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
        onFulfilled: (result: { error: null }) => unknown,
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
  return { claims, rpc };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/push/daily-reminders", () => {
  it("claims an occurrence atomically across concurrent cron calls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
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
});
