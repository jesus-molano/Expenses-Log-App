import { NextResponse } from "next/server";
import { z } from "zod";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import {
  isAllowedPushEndpoint,
  MAX_PUSH_ENDPOINT_LENGTH,
} from "@/data/push/push-endpoints";
import {
  configureWebPush,
  isExpiredPushSubscription,
  sendWebPush,
  TEST_PUSH_TTL_SECONDS,
} from "@/data/push/web-push-sender";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(MAX_PUSH_ENDPOINT_LENGTH)
    .refine(isAllowedPushEndpoint),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Suscripción push inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "AUTH_NOT_CONFIGURED" },
      { status: 503 },
    );
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
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("endpoint", parsed.data.endpoint)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Could not verify push subscription", subscriptionError);
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_CHECK_FAILED" },
      { status: 500 },
    );
  }

  if (!subscription) {
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!configureWebPush()) {
    return NextResponse.json(
      { code: "PUSH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    await sendWebPush(
      subscription,
      JSON.stringify({
        title: "Expense Reminders",
        body: "Notificación de prueba lista.",
        url: "/",
      }),
      { ttlSeconds: TEST_PUSH_TTL_SECONDS },
    );
  } catch (error) {
    if (isExpiredPushSubscription(error)) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", subscription.endpoint);
      return NextResponse.json(
        { code: "PUSH_SUBSCRIPTION_EXPIRED" },
        { status: 409 },
      );
    }

    console.error("Could not send test push notification", error);
    return NextResponse.json(
      { code: "PUSH_SEND_FAILED" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
}
