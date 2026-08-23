import { NextResponse } from "next/server";
import { z } from "zod";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

const statusSchema = z.object({
  endpoint: z.string().url(),
});

const REMINDER_KIND = "last_chance";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_PUSH_SUBSCRIPTION" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ mode: "demo", registered: false });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const userId = toDatabaseUuid(user.id);
  const { data: subscription, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("endpoint", parsed.data.endpoint)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Could not read push subscription health", subscriptionError);
    return NextResponse.json(
      { code: "PUSH_HEALTH_UNAVAILABLE" },
      { status: 500 },
    );
  }

  if (!subscription) {
    return NextResponse.json({ mode: "ready", registered: false });
  }

  const { data: delivery, error: deliveryError } = await supabase
    .from("push_reminder_deliveries")
    .select("delivered_at")
    .eq("user_id", userId)
    .eq("kind", REMINDER_KIND)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deliveryError) {
    console.error("Could not read push delivery health", deliveryError);
    return NextResponse.json(
      { code: "PUSH_HEALTH_UNAVAILABLE" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mode: "ready",
    registered: true,
    subscriptionUpdatedAt: subscription.updated_at,
    lastScheduledDeliveryAt: delivery?.delivered_at ?? null,
  });
}
