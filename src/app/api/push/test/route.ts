import { NextResponse } from "next/server";
import webpush from "web-push";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

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
    return NextResponse.json({ error: "Suscripción push inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };

  if (userError || !user) {
    return NextResponse.json(
      { error: "Inicia sesión para enviar una notificación de prueba." },
      { status: 401 },
    );
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json({
      mode: "demo",
      message: "Configura VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY para envío real.",
    });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:expense-reminders@example.com",
    publicKey,
    privateKey,
  );

  await webpush.sendNotification(
    parsed.data,
    JSON.stringify({
      title: "Expense Reminders",
      body: "Notificación de prueba lista.",
      url: "/",
    }),
  );

  return NextResponse.json({ ok: true });
}
