import { NextResponse } from "next/server";
import webpush from "web-push";
import { z } from "zod";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
});

function isExpiredPushSubscription(error: unknown) {
  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

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

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { code: "PUSH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:expense-reminders@example.com",
    publicKey,
    privateKey,
  );

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: "Expense Reminders",
        body: "Notificación de prueba lista.",
        url: "/",
      }),
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
