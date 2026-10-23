import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertPushSubscription } from "@/data/push/push-subscriptions";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  // El navegador renovó la suscripción (`pushsubscriptionchange` o clave VAPID
  // nueva): la anterior ya no sirve y se borra.
  previousEndpoint: z.string().url().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { code: "PUSH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Suscripción push inválida." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      message: "Suscripción recibida. Configura Supabase para guardarla.",
    });
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
  // También es el latido del dispositivo: renueva updated_at y olvida fallos.
  const error = await upsertPushSubscription(
    supabase,
    {
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    new Date(),
  );

  if (error) {
    console.error("Could not save push subscription", error);
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_SAVE_FAILED" },
      { status: 500 },
    );
  }

  const { previousEndpoint } = parsed.data;
  if (previousEndpoint && previousEndpoint !== parsed.data.endpoint) {
    const { error: cleanupError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", previousEndpoint);
    // La nueva ya está guardada; la antigua acabará podada por el cron.
    if (cleanupError) {
      console.error("Could not remove replaced push subscription", cleanupError);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Suscripción push inválida." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      message: "Suscripción desactivada en este dispositivo.",
    });
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

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", toDatabaseUuid(user.id))
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("Could not delete push subscription", error);
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_DELETE_FAILED" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
