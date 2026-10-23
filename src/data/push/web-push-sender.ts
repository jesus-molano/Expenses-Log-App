import webpush from "web-push";
import { isAllowedPushEndpoint } from "./push-endpoints";

export type StoredPushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Plazo de socket por envío: un servicio push que no responde no debe frenar
// el resto de dispositivos ni de usuarios del cron.
export const PUSH_SEND_TIMEOUT_MS = 5_000;

// Cuánto guarda el servicio push un aviso para un dispositivo sin conexión.
// El cron vuelve a avisar al día siguiente; la prueba solo sirve al momento.
export const REMINDER_PUSH_TTL_SECONDS = 24 * 60 * 60;
export const TEST_PUSH_TTL_SECONDS = 5 * 60;

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

export class PushEndpointNotAllowedError extends Error {
  constructor() {
    super("Push endpoint host is not allowed.");
    this.name = "PushEndpointNotAllowedError";
  }
}

// Envía un aviso a una suscripción guardada. Vuelve a comprobar el host aunque
// las rutas ya lo validen: el rol authenticated puede insertar filas en
// `push_subscriptions` directamente, sin pasar por la API.
export async function sendWebPush(
  subscription: StoredPushSubscriptionKeys,
  payload: string,
  { ttlSeconds }: { ttlSeconds: number },
) {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    throw new PushEndpointNotAllowedError();
  }

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    payload,
    { TTL: ttlSeconds, timeout: PUSH_SEND_TIMEOUT_MS },
  );
}

// 404/410: el servicio push ya no conoce la suscripción y hay que borrarla.
export function isExpiredPushSubscription(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}
