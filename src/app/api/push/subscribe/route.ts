import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { createClient } from "@/utils/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: "Configura VAPID_PUBLIC_KEY para activar push real." },
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
  const admin = createSupabaseServiceClient();

  if (!supabase || !admin) {
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
      { error: "Inicia sesión para guardar avisos push." },
      { status: 401 },
    );
  }

  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción." },
      { status: 500 },
    );
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
  const admin = createSupabaseServiceClient();

  if (!supabase || !admin) {
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
      { error: "Inicia sesión para desactivar avisos push guardados." },
      { status: 401 },
    );
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo borrar la suscripción." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
