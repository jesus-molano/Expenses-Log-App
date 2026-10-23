import {
  readPushHeartbeat,
  writePushHeartbeat,
  type PushHeartbeat,
} from "@/data/persistence/push-heartbeat-store";
import { applicationServerKeyMatches } from "@/pwa/push-subscription";
import {
  createPushSubscription,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  savePushSubscription,
} from "./push-notifications";

// Una vez al día por dispositivo, o antes si cambia el endpoint.
export const PUSH_HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function isHeartbeatDue(
  last: PushHeartbeat | null,
  endpoint: string,
  now: Date,
) {
  if (!last || last.endpoint !== endpoint) return true;
  const elapsed = now.getTime() - Date.parse(last.at);
  // Un reloj que va hacia atrás tampoco debe dejarlo sin latido.
  return elapsed >= PUSH_HEARTBEAT_INTERVAL_MS || elapsed < 0;
}

export type HeartbeatResult = "skipped" | "confirmed" | "renewed";

// Latido de la suscripción (M12): confirma al servidor que el dispositivo
// sigue suscrito, y si la clave VAPID cambió crea una suscripción nueva y
// borra la antigua. Nunca pide permiso: sin permiso o sin suscripción no hace
// nada. Los errores (sin red, sin sesión) los decide quien llama.
export async function syncPushHeartbeat(now: Date = new Date()): Promise<HeartbeatResult> {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return "skipped";
  }

  const subscription = await getCurrentPushSubscription();
  if (!subscription || !isHeartbeatDue(readPushHeartbeat(), subscription.endpoint, now)) {
    return "skipped";
  }

  const { publicKey } = await fetchPushSubscribeConfig();
  if (applicationServerKeyMatches(subscription.options?.applicationServerKey, publicKey)) {
    await savePushSubscription(subscription);
    writePushHeartbeat({ endpoint: subscription.endpoint, at: now.toISOString() });
    return "confirmed";
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return "skipped";
  const renewed = await createPushSubscription(registration, publicKey);
  await savePushSubscription(renewed, { previousEndpoint: subscription.endpoint });
  writePushHeartbeat({ endpoint: renewed.endpoint, at: now.toISOString() });
  return "renewed";
}
