import { NextResponse } from "next/server";
import { z } from "zod";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import {
  isAllowedPushEndpoint,
  MAX_PUSH_ENDPOINT_LENGTH,
  pushEndpointsToEvict,
} from "@/data/push/push-endpoints";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(MAX_PUSH_ENDPOINT_LENGTH),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

// Para borrar basta con que sea una URL: así se pueden limpiar también filas
// antiguas de hosts que ya no se aceptan.
const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(MAX_PUSH_ENDPOINT_LENGTH),
});

// Postgres rechaza por RLS el upsert de un endpoint que ya es de otra cuenta
// (este navegador lo registró antes con otro usuario).
const RLS_VIOLATION = "42501";

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

  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json(
      { code: "PUSH_ENDPOINT_NOT_ALLOWED" },
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
  const { data: stored, error: listError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, updated_at")
    .eq("user_id", userId);

  if (listError) {
    console.error("Could not list push subscriptions", listError);
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_SAVE_FAILED" },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error?.code === RLS_VIOLATION) {
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_IN_USE" },
      { status: 409 },
    );
  }

  if (error) {
    console.error("Could not save push subscription", error);
    return NextResponse.json(
      { code: "PUSH_SUBSCRIPTION_SAVE_FAILED" },
      { status: 500 },
    );
  }

  // Límite de dispositivos: el nuevo sustituye a los que llevan más tiempo
  // sin actualizarse. Se borra después de guardar, para no perder ninguno si
  // el guardado falla. Si el borrado falla o dos altas coinciden, el usuario
  // se pasa por poco y el cron solo envía a los más recientes; la restricción
  // en la base de datos llega con la migración de F0c-2.
  const evicted = pushEndpointsToEvict(stored ?? [], parsed.data.endpoint);
  if (evicted.length) {
    const { error: evictError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .in("endpoint", evicted);

    if (evictError) {
      console.error("Could not evict old push subscriptions", evictError);
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
