import { NextResponse } from "next/server";
import webpush from "web-push";
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
  invalidSubscriptionsRemoved: number;
};

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
    invalidSubscriptionsRemoved: 0,
  };

  for (const storeRow of stores ?? []) {
    if (!isExpenseStore(storeRow.store)) continue;

    const userSubscriptions = subscriptionsByUser.get(storeRow.user_id) ?? [];
    if (!userSubscriptions.length) continue;

    const reminder = buildDailyReminder(storeRow.store);
    if (!reminder) continue;

    summary.usersWithReminders += 1;
    const payload = JSON.stringify({
      title: dailyReminderTitle(reminder),
      body: dailyReminderBody(reminder),
      url: "/",
    });

    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification(toPushSubscription(subscription), payload);
        summary.notificationsSent += 1;
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
  }

  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return handleDailyReminders(request);
}

export async function POST(request: Request) {
  return handleDailyReminders(request);
}
