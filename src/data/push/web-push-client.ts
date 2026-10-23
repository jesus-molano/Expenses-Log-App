import webpush from "web-push";
import type { PushNotificationPayload } from "@/pwa/push-payload";

// Un servicio push que no contesta no debe retrasar al resto de dispositivos
// ni al cron.
export const PUSH_SEND_TIMEOUT_MS = 5_000;

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:expense-reminders@example.com",
    publicKey,
    privateKey,
  );
  return true;
}

export function sendWebPush(
  target: PushTarget,
  payload: PushNotificationPayload,
  { ttlSeconds }: { ttlSeconds: number },
) {
  return webpush.sendNotification(
    {
      endpoint: target.endpoint,
      keys: { p256dh: target.p256dh, auth: target.auth },
    },
    JSON.stringify(payload),
    {
      TTL: ttlSeconds,
      timeout: PUSH_SEND_TIMEOUT_MS,
      urgency: "normal",
    },
  );
}

function pushErrorStatus(error: unknown) {
  return (error as { statusCode?: number } | null)?.statusCode;
}

// El servicio push dice que la suscripción ya no existe: no tiene arreglo.
export function isExpiredPushSubscription(error: unknown) {
  const statusCode = pushErrorStatus(error);
  return statusCode === 404 || statusCode === 410;
}
