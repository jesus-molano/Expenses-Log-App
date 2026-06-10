import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Suscripcion push invalida." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      message: "Suscripcion recibida. Configura Supabase para guardarla.",
    });
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: "demo",
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la suscripcion." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
