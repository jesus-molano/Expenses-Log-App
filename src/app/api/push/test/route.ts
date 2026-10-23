import { NextResponse } from "next/server";
import { z } from "zod";
import {
  configureWebPush,
  isExpiredPushSubscription,
  sendWebPush,
} from "@/data/push/web-push-client";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { t } from "@/shared/i18n";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  language: z.enum(["es", "en"]).optional(),
});

// Una prueba que no llega en 5 minutos ya no sirve.
const TEST_PUSH_TTL_SECONDS = 5 * 60;

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

  const language = parsed.data.language ?? "es";
  try {
    await sendWebPush(
      subscription,
      {
        title: t("reminders.pushTestTitle", language),
        body: t("reminders.pushTestBody", language),
        url: "/",
        tag: "push-test",
        lang: language,
      },
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
