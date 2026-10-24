import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { groupDeliverablePushSubscriptions } from "@/data/push/push-endpoints";
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
} from "@/data/push/web-push-sender";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import type { AppSupabaseClient, UUID } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import {
  buildReminderNotifications,
  planUserReminders,
  type ReminderCandidate,
  type ReminderNotification,
} from "@/features/expenses/lib/reminder-notifications";
import { toReminderStore } from "@/features/expenses/lib/reminder-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

type Claim = {
  candidate: ReminderCandidate;
  claimToken: UUID;
  // "open": aún sin cerrar; "settled": marcado o liberado; "failed": no se
  // pudo cerrar y caduca solo a los 15 minutos.
  state: "open" | "settled" | "failed";
};

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

  // Solo hosts de servicios push y, como mucho, los 10 dispositivos
  // actualizados más recientemente de cada usuario.
  const { byUser: subscriptionsByUser, blocked } =
    groupDeliverablePushSubscriptions<PushSubscriptionRow>(subscriptions ?? []);

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
  const now = new Date();

  // Un usuario con datos rotos o un fallo puntual de la base de datos no
  // corta la ejecución para los demás.
  for (const storeRow of stores ?? []) {
    const userSubscriptions = subscriptionsByUser.get(storeRow.user_id);
    if (!userSubscriptions?.length) continue;

    try {
      const store = toReminderStore(storeRow.store, now);
      if (!store) {
        summary.invalidStoresSkipped += 1;
        continue;
      }
      await deliverUserReminders({
        admin,
        userId: storeRow.user_id,
        store,
        subscriptions: userSubscriptions,
        now,
        summary,
      });
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

// Reclama cada aviso con su tipo, envía una notificación por tipo y cierra lo
// reclamado siempre, también si falla una reclamación a medias o un envío:
// marcado si llegó a algún dispositivo, liberado si no.
async function deliverUserReminders({
  admin,
  userId,
  store,
  subscriptions,
  now,
  summary,
}: {
  admin: AppSupabaseClient;
  userId: UUID;
  store: ExpenseStore;
  subscriptions: PushSubscriptionRow[];
  now: Date;
  summary: DeliverySummary;
}) {
  const plan = planUserReminders(store, now);
  if (!plan?.candidates.length) return;

  const claims: Claim[] = [];
  const devices = [...subscriptions];
  let failure: { error: unknown } | null = null;

  try {
    for (const candidate of plan.candidates) {
      const claimToken = await claimReminderDelivery(admin, deliveryRef(userId, candidate));
      if (!claimToken) {
        summary.duplicateDeliveriesSkipped += 1;
        continue;
      }
      claims.push({ candidate, claimToken, state: "open" });
    }
    if (!claims.length) return;
    summary.usersWithReminders += 1;

    const notifications = buildReminderNotifications(
      plan,
      claims.map((claim) => claim.candidate),
    );
    for (const notification of notifications) {
      const accepted = await sendToDevices(admin, devices, notification, now, summary);
      // Entregado si al menos un dispositivo lo aceptó; si no, se libera para
      // que la siguiente ejecución lo intente.
      await settleClaims(
        admin,
        userId,
        claims.filter((claim) => notification.candidates.includes(claim.candidate)),
        accepted > 0,
      );
    }
  } catch (error) {
    failure = { error };
  }

  // Lo que quedó sin enviar (reclamación a medias, fallo a mitad o un tipo
  // sin notificación) se libera.
  await settleClaims(
    admin,
    userId,
    claims.filter((claim) => claim.state === "open"),
    false,
  );
  if (failure) throw failure.error;
  if (claims.some((claim) => claim.state !== "settled")) {
    throw new Error("Push reminder leases were not settled.");
  }
}

function deliveryRef(userId: UUID, candidate: ReminderCandidate) {
  return { userId, reminderKey: candidate.key, kind: candidate.kind };
}

// Cierra cada lease por separado, para que un fallo no deje los demás
// abiertos. El que no se pudo cerrar queda como "failed": caduca a los 15
// minutos y otra ejecución puede volver a reclamarlo.
async function settleClaims(
  admin: AppSupabaseClient,
  userId: UUID,
  claims: Claim[],
  delivered: boolean,
) {
  if (!claims.length) return;

  const settle = delivered ? markReminderDelivered : releaseReminderDelivery;
  const results = await Promise.allSettled(
    claims.map((claim) =>
      settle(admin, deliveryRef(userId, claim.candidate), claim.claimToken),
    ),
  );
  const failed: unknown[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      claims[index].state = "settled";
      return;
    }
    claims[index].state = "failed";
    failed.push(result.reason);
  });
  if (!failed.length) return;

  console.error("Could not settle push reminder leases", {
    userId,
    delivered,
    failed: failed.length,
    error: describeError(failed[0]),
  });
}

// Envía a todos los dispositivos a la vez: uno lento (5 s como mucho) no
// retrasa a los demás. Una suscripción caducada (404/410) se borra; otros
// fallos se cuentan y, repetidos (MAX_PUSH_FAILURES), también la borran.
// Devuelve cuántos dispositivos aceptaron el aviso.
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
