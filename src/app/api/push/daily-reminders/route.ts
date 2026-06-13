import { NextResponse } from "next/server";
import webpush from "web-push";
import type { UUID } from "@/data/supabase/database.types";
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
    return NextResponse.json({ error: storesError.message }, { status: 500 });
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  if (subscriptionsError) {
    return NextResponse.json(
      { error: subscriptionsError.message },
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

    const reminderKey = buildReminderDeliveryKey(reminder);
    const alreadyDelivered = await hasReminderDelivery(
      admin,
      storeRow.user_id,
      reminderKey,
    );
    if (alreadyDelivered) {
      summary.duplicateDeliveriesSkipped += 1;
      continue;
    }

    summary.usersWithReminders += 1;
    const payload = JSON.stringify({
      title: dailyReminderTitle(reminder),
      body: dailyReminderBody(reminder),
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
      await recordReminderDelivery(admin, storeRow.user_id, reminderKey);
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

function buildReminderDeliveryKey(reminder: ReturnType<typeof buildDailyReminder>) {
  if (!reminder) return "";

  return reminder.occurrences
    .map(
      (occurrence) =>
        `${occurrence.template.id}:${occurrence.occurrenceDate}:${occurrence.estimatedChargeDate}`,
    )
    .sort()
    .join("|");
}

async function hasReminderDelivery(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  userId: UUID,
  reminderKey: string,
) {
  const { data, error } = await admin
    .from("push_reminder_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("reminder_key", reminderKey)
    .eq("kind", REMINDER_KIND)
    .maybeSingle();

  if (error && !error.message.includes("push_reminder_deliveries")) throw error;
  return Boolean(data);
}

async function recordReminderDelivery(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  userId: UUID,
  reminderKey: string,
) {
  const { error } = await admin.from("push_reminder_deliveries").upsert(
    {
      user_id: userId,
      reminder_key: reminderKey,
      kind: REMINDER_KIND,
      delivered_at: new Date().toISOString(),
    },
    { onConflict: "user_id,reminder_key,kind", ignoreDuplicates: true },
  );

  if (error && !error.message.includes("push_reminder_deliveries")) throw error;
}
