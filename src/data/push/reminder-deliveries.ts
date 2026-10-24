import type { AppSupabaseClient, UUID } from "@/data/supabase/database.types";

// Lease de 15 minutos por aviso: otra ejecución no puede enviarlo a la vez,
// pero lo recupera si el proceso anterior cae antes de marcarlo.
export const DELIVERY_LEASE_SECONDS = 15 * 60;

type DeliveryRef = {
  userId: UUID;
  reminderKey: string;
  kind: string;
};

export async function claimReminderDelivery(
  admin: AppSupabaseClient,
  { userId, reminderKey, kind }: DeliveryRef,
) {
  const { data, error } = await admin.rpc("claim_push_reminder_delivery", {
    p_user_id: userId,
    p_reminder_key: reminderKey,
    p_kind: kind,
    p_lease_seconds: DELIVERY_LEASE_SECONDS,
  });

  if (error) throw error;
  return data;
}

export async function markReminderDelivered(
  admin: AppSupabaseClient,
  { userId, reminderKey, kind }: DeliveryRef,
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
    .eq("kind", kind)
    .eq("status", "claimed")
    .eq("claim_token", claimToken);

  if (error) throw error;
}

export async function releaseReminderDelivery(
  admin: AppSupabaseClient,
  { userId, reminderKey, kind }: DeliveryRef,
  claimToken: UUID,
) {
  const { error } = await admin
    .from("push_reminder_deliveries")
    .delete()
    .eq("user_id", userId)
    .eq("reminder_key", reminderKey)
    .eq("kind", kind)
    .eq("status", "claimed")
    .eq("claim_token", claimToken);

  if (error) throw error;
}
