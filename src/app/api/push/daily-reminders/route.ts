import { NextResponse } from "next/server";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import {
  recordPushFailure,
  recordPushSuccess,
  removePushSubscription,
  tracksFailures,
  type PushSubscriptionRow,
} from "@/data/push/push-subscriptions";
import {
  claimReminderDelivery,
  markReminderDelivered,
  releaseReminderDelivery,
} from "@/data/push/reminder-deliveries";
import {
  configureWebPush,
  isExpiredPushSubscription,
  sendWebPush,
} from "@/data/push/web-push-client";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import type { AppSupabaseClient, UUID } from "@/data/supabase/database.types";
import {
  buildReminderNotifications,
  planUserReminders,
  type ReminderCandidate,
  type ReminderNotification,
} from "@/features/expenses/lib/reminder-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeliverySummary = {
  usersChecked: number;
  usersWithReminders: number;
  notificationsSent: number;
  notificationsFailed: number;
  duplicateDeliveriesSkipped: number;
  invalidSubscriptionsRemoved: number;
  // Usuarios cuyo cálculo o envío falló; el resto sigue adelante.
  errors: number;
};

type Claim = {
  candidate: ReminderCandidate;
  claimToken: UUID;
  settled: boolean;
};

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "missing_secret";

  return request.headers.get("authorization") === `Bearer ${secret}`
    ? "authorized"
    : "unauthorized";
}

// El cron puede correr cada hora: cada usuario recibe lo del día a partir de la
// hora que eligió en su zona, y las entregas ya hechas no se repiten.
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

  // "*" para leer también el contador de fallos cuando la migración existe.
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("*");
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
    errors: 0,
  };
  const now = new Date();

  for (const storeRow of stores ?? []) {
    const userSubscriptions = subscriptionsByUser.get(storeRow.user_id) ?? [];
    if (!userSubscriptions.length) continue;

    await deliverUserReminders({
      admin,
      userId: storeRow.user_id,
      rawStore: storeRow.store,
      subscriptions: userSubscriptions,
      now,
      summary,
    });
  }

  return NextResponse.json({ ok: true, ...summary });
}

// Un store ilegible o un error de la base de datos con un usuario no corta el
// envío al resto: se cuenta, se registra y se liberan sus reclamaciones.
async function deliverUserReminders({
  admin,
  userId,
  rawStore,
  subscriptions,
  now,
  summary,
}: {
  admin: AppSupabaseClient;
  userId: UUID;
  rawStore: unknown;
  subscriptions: PushSubscriptionRow[];
  now: Date;
  summary: DeliverySummary;
}) {
  const claims: Claim[] = [];
  const devices = [...subscriptions];

  try {
    if (!rawStore || typeof rawStore !== "object") return;
    const plan = planUserReminders(normalizeExpenseStore(rawStore, now), now);
    if (!plan?.candidates.length) return;

    for (const candidate of plan.candidates) {
      const claimToken = await claimReminderDelivery(admin, deliveryRef(userId, candidate));
      if (!claimToken) {
        summary.duplicateDeliveriesSkipped += 1;
        continue;
      }
      claims.push({ candidate, claimToken, settled: false });
    }
    if (!claims.length) return;
    summary.usersWithReminders += 1;

    const notifications = buildReminderNotifications(
      plan,
      claims.map((claim) => claim.candidate),
    );
    for (const notification of notifications) {
      const accepted = await sendToDevices(admin, devices, notification, now, summary);
      for (const claim of claims) {
        if (!notification.candidates.includes(claim.candidate)) continue;
        // Entregado si al menos un dispositivo lo aceptó; si no, se libera
        // para que la siguiente ejecución lo intente.
        if (accepted > 0) {
          await markReminderDelivered(admin, deliveryRef(userId, claim.candidate), claim.claimToken);
        } else {
          await releaseReminderDelivery(admin, deliveryRef(userId, claim.candidate), claim.claimToken);
        }
        claim.settled = true;
      }
    }
  } catch (error) {
    summary.errors += 1;
    console.error("Push reminders failed for a user", {
      code: (error as { code?: string } | null)?.code ?? "unknown",
    });
  } finally {
    await Promise.allSettled(
      claims
        .filter((claim) => !claim.settled)
        .map((claim) =>
          releaseReminderDelivery(admin, deliveryRef(userId, claim.candidate), claim.claimToken),
        ),
    );
  }
}

function deliveryRef(userId: UUID, candidate: ReminderCandidate) {
  return { userId, reminderKey: candidate.key, kind: candidate.kind };
}

// Envía a todos los dispositivos a la vez. Una suscripción caducada se borra;
// otros fallos se cuentan y, repetidos, también la borran. Devuelve cuántos
// dispositivos aceptaron el aviso.
async function sendToDevices(
  admin: AppSupabaseClient,
  devices: PushSubscriptionRow[],
  notification: ReminderNotification,
  now: Date,
  summary: DeliverySummary,
) {
  const targets = [...devices];
  const results = await Promise.allSettled(
    targets.map((device) =>
      sendWebPush(device, notification.payload, { ttlSeconds: notification.ttlSeconds }),
    ),
  );
  let accepted = 0;

  for (const [index, result] of results.entries()) {
    const device = targets[index];
    if (result.status === "fulfilled") {
      accepted += 1;
      summary.notificationsSent += 1;
      await recordPushSuccess(admin, device, now);
      if (tracksFailures(device)) device.failure_count = 0;
      continue;
    }

    summary.notificationsFailed += 1;
    const removed = isExpiredPushSubscription(result.reason)
      ? await removePushSubscription(admin, device.endpoint)
      : (await recordPushFailure(admin, device, now)) === "removed";
    if (removed) summary.invalidSubscriptionsRemoved += 1;
    // En esta ejecución no se vuelve a intentar con ese dispositivo.
    devices.splice(devices.indexOf(device), 1);
  }

  return accepted;
}

export async function GET(request: Request) {
  return handleDailyReminders(request);
}

export async function POST(request: Request) {
  return handleDailyReminders(request);
}
