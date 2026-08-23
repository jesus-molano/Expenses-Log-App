import { NextResponse } from "next/server";
import webpush from "web-push";
import type { UUID } from "@/data/supabase/database.types";
import type { ExpenseOccurrence } from "@/domain/types";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import {
  buildDailyReminder,
  dailyReminderBody,
  dailyReminderTitle,
  isExpenseStore,
} from "@/features/expenses/lib/daily-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type DeliverySummary = {
  usersChecked: number;
  usersWithReminders: number;
  notificationsSent: number;
  notificationsFailed: number;
  duplicateDeliveriesSkipped: number;
  invalidSubscriptionsRemoved: number;
};

const REMINDER_KIND = "last_chance";
const DELIVERY_LEASE_SECONDS = 15 * 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "missing_secret";

  return request.headers.get("authorization") === `Bearer ${secret}`
    ? "authorized"
    : "unauthorized";
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:expense-reminders@example.com",
    publicKey,
    privateKey,
  );
  return true;
}

function toPushSubscription(subscription: PushSubscriptionRow) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isExpiredPushSubscription(error: unknown) {
  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

async function handleDailyReminders(request: Request) {
  const auth = authorizeCron(request);
  if (auth === "missing_secret") {
    return NextResponse.json(
      { error: "Configura CRON_SECRET para proteger el cron." },
      { status: 503 },
    );
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!configureWebPush()) {
    return NextResponse.json(
      { error: "Configura VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY." },
      { status: 503 },
    );
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Configura Supabase service role para enviar recordatorios." },
      { status: 503 },
    );
  }

  const { data: stores, error: storesError } = await admin
    .from("app_stores")
    .select("user_id, store");
  if (storesError) {
    console.error("Could not load stores for push reminders", storesError);
    return NextResponse.json(
      { code: "PUSH_STORES_UNAVAILABLE" },
      { status: 500 },
    );
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  if (subscriptionsError) {
    console.error(
      "Could not load subscriptions for push reminders",
      subscriptionsError,
    );
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTIONS_UNAVAILABLE" },
      { status: 500 },
    );
  }

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of subscriptions ?? []) {
    const current = subscriptionsByUser.get(subscription.user_id) ?? [];
    current.push(subscription);
    subscriptionsByUser.set(subscription.user_id, current);
  }

  const summary: DeliverySummary = {
    usersChecked: stores?.length ?? 0,
    usersWithReminders: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    duplicateDeliveriesSkipped: 0,
    invalidSubscriptionsRemoved: 0,
  };

  for (const storeRow of stores ?? []) {
    if (!isExpenseStore(storeRow.store)) continue;

    const userSubscriptions = subscriptionsByUser.get(storeRow.user_id) ?? [];
    if (!userSubscriptions.length) continue;

    const reminder = buildDailyReminder(storeRow.store);
    if (!reminder) continue;

    const claimedOccurrences: Array<{
      occurrence: ExpenseOccurrence;
      reminderKey: string;
      claimToken: UUID;
    }> = [];
    for (const occurrence of reminder.occurrences) {
      const reminderKey = buildReminderDeliveryKey(occurrence);
      const claimToken = await claimReminderDelivery(
        admin,
        storeRow.user_id,
        reminderKey,
      );
      if (!claimToken) {
        summary.duplicateDeliveriesSkipped += 1;
        continue;
      }
      claimedOccurrences.push({ occurrence, reminderKey, claimToken });
    }
    if (!claimedOccurrences.length) continue;

    summary.usersWithReminders += 1;
    const pendingReminder = {
      ...reminder,
      occurrences: claimedOccurrences.map(({ occurrence }) => occurrence),
    };
    const payload = JSON.stringify({
      title: dailyReminderTitle(pendingReminder),
      body: dailyReminderBody(pendingReminder),
      url: "/",
    });
    let userNotificationsSent = 0;

    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification(toPushSubscription(subscription), payload);
        summary.notificationsSent += 1;
        userNotificationsSent += 1;
      } catch (error) {
        summary.notificationsFailed += 1;

        if (isExpiredPushSubscription(error)) {
          const { error: deleteError } = await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
          if (!deleteError) summary.invalidSubscriptionsRemoved += 1;
        }
      }
    }

    if (userNotificationsSent > 0) {
      for (const { reminderKey, claimToken } of claimedOccurrences) {
        await markReminderDelivered(
          admin,
          storeRow.user_id,
          reminderKey,
          claimToken,
        );
      }
    } else {
      for (const { reminderKey, claimToken } of claimedOccurrences) {
        await releaseReminderDelivery(
          admin,
          storeRow.user_id,
          reminderKey,
          claimToken,
        );
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return handleDailyReminders(request);
}

export async function POST(request: Request) {
  return handleDailyReminders(request);
}

export function buildReminderDeliveryKey(occurrence: ExpenseOccurrence) {
  return `${occurrence.template.id}:${occurrence.occurrenceDate}:${occurrence.estimatedChargeDate}`;
}

async function claimReminderDelivery(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  userId: UUID,
  reminderKey: string,
) {
  const { data, error } = await admin.rpc("claim_push_reminder_delivery", {
    p_user_id: userId,
    p_reminder_key: reminderKey,
    p_kind: REMINDER_KIND,
    p_lease_seconds: DELIVERY_LEASE_SECONDS,
  });

  if (error) throw error;
  return data;
}

async function markReminderDelivered(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  userId: UUID,
  reminderKey: string,
  claimToken: UUID,
) {
  const { error } = await admin
    .from("push_reminder_deliveries")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      claim_token: null,
    })
    .eq("user_id", userId)
    .eq("reminder_key", reminderKey)
    .eq("kind", REMINDER_KIND)
    .eq("status", "claimed")
    .eq("claim_token", claimToken);

  if (error) throw error;
}

async function releaseReminderDelivery(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  userId: UUID,
  reminderKey: string,
  claimToken: UUID,
) {
  const { error } = await admin
    .from("push_reminder_deliveries")
    .delete()
    .eq("user_id", userId)
    .eq("reminder_key", reminderKey)
    .eq("kind", REMINDER_KIND)
    .eq("status", "claimed")
    .eq("claim_token", claimToken);

  if (error) throw error;
}
