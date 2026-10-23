import type {
  AppSupabaseClient,
  Database,
} from "@/data/supabase/database.types";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { isMissingRpcError } from "@/data/supabase/rpc-errors";

export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];

const CLAIM_RPC = "claim_push_subscription";

// Envíos fallidos seguidos (sin contar 404/410, que se borran al momento)
// antes de dar la suscripción por muerta.
export const MAX_PUSH_FAILURES = 5;

type PostgrestErrorLike = { code?: string } | null | undefined;

// Columna que aún no existe: la migración de salud de las suscripciones no se
// ha aplicado. La app sigue funcionando sin contar fallos.
export function isMissingColumnError(error: PostgrestErrorLike) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

// La fila trae el contador solo si la migración está aplicada (select "*").
export function tracksFailures(
  row: PushSubscriptionRow,
): row is PushSubscriptionRow & { failure_count: number } {
  return typeof row.failure_count === "number";
}

export async function removePushSubscription(
  client: AppSupabaseClient,
  endpoint: string,
) {
  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  return !error;
}

// Un fallo que no es definitivo (403 por clave VAPID, 5xx, tiempo agotado)
// suma uno; al llegar al máximo se borra la suscripción. El dispositivo vuelve
// a registrarse solo con el latido de la app si sigue vivo.
export async function recordPushFailure(
  admin: AppSupabaseClient,
  row: PushSubscriptionRow,
  now: Date,
): Promise<"removed" | "counted" | "untracked"> {
  if (!tracksFailures(row)) return "untracked";

  const failureCount = row.failure_count + 1;
  if (failureCount >= MAX_PUSH_FAILURES) {
    return (await removePushSubscription(admin, row.endpoint)) ? "removed" : "counted";
  }

  const { error } = await admin
    .from("push_subscriptions")
    .update({ failure_count: failureCount, last_failure_at: now.toISOString() })
    .eq("endpoint", row.endpoint);
  if (error && !isMissingColumnError(error)) {
    console.error("Could not record push failure", error);
  }
  return "counted";
}

// Solo escribe si había fallos que olvidar: un envío correcto no cuesta una
// escritura por dispositivo.
export async function recordPushSuccess(
  admin: AppSupabaseClient,
  row: PushSubscriptionRow,
  now: Date,
) {
  if (!tracksFailures(row) || row.failure_count === 0) return;

  const { error } = await admin
    .from("push_subscriptions")
    .update({ failure_count: 0, last_success_at: now.toISOString() })
    .eq("endpoint", row.endpoint);
  if (error && !isMissingColumnError(error)) {
    console.error("Could not reset push failures", error);
  }
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

// Registra el endpoint de este navegador para la cuenta actual. También es el
// latido del dispositivo: renueva `updated_at` y pone a cero los fallos.
// El RPC lo reclama aunque lo registrara antes otra cuenta en el mismo
// dispositivo (con el upsert directo la RLS lo bloquea), respeta el máximo de
// 10 por usuario y, con la migración de salud, también pone failure_count a 0.
// Sin la migración que lo crea se usa el upsert de siempre.
export async function savePushSubscription(
  supabase: AppSupabaseClient,
  userId: string,
  subscription: PushSubscriptionInput,
  now: Date = new Date(),
): Promise<void> {
  const { error } = await supabase.rpc(CLAIM_RPC, {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
  });

  if (!error) return;
  if (!isMissingRpcError(error, CLAIM_RPC)) throw error;

  const upsertError = await upsertPushSubscription(
    supabase,
    userId,
    subscription,
    now,
  );
  if (upsertError) throw upsertError;
}

// Camino sin el RPC: upsert que olvida los fallos. Sin la migración de salud
// aplicada repite el upsert sin las columnas nuevas.
async function upsertPushSubscription(
  supabase: AppSupabaseClient,
  userId: string,
  subscription: PushSubscriptionInput,
  now: Date,
) {
  const row = {
    user_id: toDatabaseUuid(userId),
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    updated_at: now.toISOString(),
  };
  const withHealth = await supabase
    .from("push_subscriptions")
    .upsert(
      { ...row, failure_count: 0, last_failure_at: null },
      { onConflict: "endpoint" },
    );
  if (!isMissingColumnError(withHealth.error)) return withHealth.error;

  const plain = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" });
  return plain.error;
}
