import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { UUID } from "@/data/supabase/database.types";
import type { ExpenseOccurrence } from "@/domain/types";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { groupDeliverablePushSubscriptions } from "@/data/push/push-endpoints";
import {
  configureWebPush,
  isExpiredPushSubscription,
  REMINDER_PUSH_TTL_SECONDS,
  sendWebPush,
  type StoredPushSubscriptionKeys,
} from "@/data/push/web-push-sender";
import {
  buildDailyReminder,
  dailyReminderBody,
  dailyReminderTitle,
  toReminderStore,
} from "@/features/expenses/lib/daily-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type DeliverySummary = {
  usersChecked: number;
  usersWithReminders: number;
  notificationsSent: number;
  notificationsFailed: number;
  duplicateDeliveriesSkipped: number;
  invalidSubscriptionsRemoved: number;
  // Stores que no tienen forma de store (no se puede avisar a ese usuario).
  invalidStoresSkipped: number;
  // Filas con un endpoint fuera de la lista de servicios push.
  blockedEndpointsSkipped: number;
  // Usuarios cuyo envío falló por un error inesperado (RPC, base de datos o
  // datos rotos). El resto de usuarios se procesa igual.
  errors: number;
};

type ClaimedReminder = {
  occurrence: ExpenseOccurrence;
  reminderKey: string;
  claimToken: UUID;
};

const REMINDER_KIND = "last_chance";
const DELIVERY_LEASE_SECONDS = 15 * 60;

// Comparación en tiempo constante: `===` deja medir cuántos caracteres del
// secreto coinciden.
function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "missing_secret";

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length &&
    timingSafeEqual(received, expected)
    ? "authorized"
    : "unauthorized";
}

// Para el log: sin datos del store ni del usuario más allá de su id.
function describeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    return { code, message };
  }
  return { message: String(error) };
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
    .select("user_id, endpoint, p256dh, auth, updated_at");
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

  const { byUser: subscriptionsByUser, blocked } =
    groupDeliverablePushSubscriptions(subscriptions ?? []);

  const summary: DeliverySummary = {
    usersChecked: stores?.length ?? 0,
    usersWithReminders: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    duplicateDeliveriesSkipped: 0,
    invalidSubscriptionsRemoved: 0,
    invalidStoresSkipped: 0,
    blockedEndpointsSkipped: blocked,
    errors: 0,
  };

  // Un usuario con datos rotos o un fallo puntual de la base de datos no
  // corta la ejecución para los demás.
  for (const storeRow of stores ?? []) {
    const userSubscriptions = subscriptionsByUser.get(storeRow.user_id);
    if (!userSubscriptions?.length) continue;

    try {
      const store = toReminderStore(storeRow.store);
      if (!store) {
        summary.invalidStoresSkipped += 1;
        continue;
      }
      await deliverUserReminders(
        admin,
        storeRow.user_id,
        buildDailyReminder(store),
        userSubscriptions,
        summary,
      );
    } catch (error) {
      summary.errors += 1;
      console.error("Could not deliver push reminders for a user", {
        userId: storeRow.user_id,
        error: describeError(error),
      });
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

async function deliverUserReminders(
  admin: AdminClient,
  userId: UUID,
  reminder: ReturnType<typeof buildDailyReminder>,
  subscriptions: StoredPushSubscriptionKeys[],
  summary: DeliverySummary,
) {
  if (!reminder) return;

  const claimed: ClaimedReminder[] = [];
  let delivered = false;
  let failure: { error: unknown } | null = null;

  // Lo reclamado se cierra siempre, también si falla una reclamación a
  // medias o el envío: marcado si llegó a algún dispositivo, liberado si no.
  try {
    for (const occurrence of reminder.occurrences) {
      const reminderKey = buildReminderDeliveryKey(occurrence);
      const claimToken = await claimReminderDelivery(admin, userId, reminderKey);
      if (!claimToken) {
        summary.duplicateDeliveriesSkipped += 1;
        continue;
      }
      claimed.push({ occurrence, reminderKey, claimToken });
    }
    if (!claimed.length) return;

    summary.usersWithReminders += 1;
    const pendingReminder = {
      ...reminder,
      occurrences: claimed.map(({ occurrence }) => occurrence),
    };
    const payload = JSON.stringify({
      title: dailyReminderTitle(pendingReminder),
      body: dailyReminderBody(pendingReminder),
      url: "/",
    });

    // Todos los dispositivos a la vez: uno lento (5 s como mucho) no retrasa
    // a los demás.
    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        sendWebPush(subscription, payload, {
          ttlSeconds: REMINDER_PUSH_TTL_SECONDS,
        }),
      ),
    );
    const expiredEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        summary.notificationsSent += 1;
        delivered = true;
        return;
      }
      summary.notificationsFailed += 1;
      if (isExpiredPushSubscription(result.reason)) {
        expiredEndpoints.push(subscriptions[index].endpoint);
      }
    });

    if (expiredEndpoints.length) {
      await removeExpiredSubscriptions(admin, userId, expiredEndpoints, summary);
    }
  } catch (error) {
    failure = { error };
  }

  const settled = await settleClaims(admin, userId, claimed, delivered);
  if (failure) throw failure.error;
  if (!settled) throw new Error("Push reminder leases were not settled.");
}

async function removeExpiredSubscriptions(
  admin: AdminClient,
  userId: UUID,
  endpoints: string[],
  summary: DeliverySummary,
) {
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .in("endpoint", endpoints);

  if (error) {
    // Se volverá a intentar en la siguiente ejecución.
    console.error("Could not remove expired push subscriptions", describeError(error));
    return;
  }
  summary.invalidSubscriptionsRemoved += endpoints.length;
}

// Cierra cada lease por separado, para que un fallo no deje los demás
// abiertos. Devuelve false si alguno no se pudo cerrar: caduca a los 15
// minutos y otra ejecución puede volver a reclamarlo.
async function settleClaims(
  admin: AdminClient,
  userId: UUID,
  claimed: ClaimedReminder[],
  delivered: boolean,
) {
  if (!claimed.length) return true;

  const settle = delivered ? markReminderDelivered : releaseReminderDelivery;
  const results = await Promise.allSettled(
    claimed.map(({ reminderKey, claimToken }) =>
      settle(admin, userId, reminderKey, claimToken),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (!failed.length) return true;

  console.error("Could not settle push reminder leases", {
    userId,
    delivered,
    failed: failed.length,
    error: describeError(failed[0].reason),
  });
  return false;
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
  admin: AdminClient,
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
  admin: AdminClient,
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
  admin: AdminClient,
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
