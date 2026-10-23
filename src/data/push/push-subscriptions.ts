import type { AppSupabaseClient } from "@/data/supabase/database.types";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { isMissingRpcError } from "@/data/supabase/rpc-errors";

const CLAIM_RPC = "claim_push_subscription";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

// Registra el endpoint de este navegador para la cuenta actual. El RPC lo
// reclama aunque lo registrara antes otra cuenta en el mismo dispositivo (con
// el upsert directo la RLS lo bloquea) y respeta el máximo de 10 por usuario.
// Sin la migración que lo crea se usa el upsert de siempre.
export async function savePushSubscription(
  supabase: AppSupabaseClient,
  userId: string,
  subscription: PushSubscriptionInput,
): Promise<void> {
  const { error } = await supabase.rpc(CLAIM_RPC, {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
  });

  if (!error) return;
  if (!isMissingRpcError(error, CLAIM_RPC)) throw error;

  const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: toDatabaseUuid(userId),
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (upsertError) throw upsertError;
}
