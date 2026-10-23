// Endpoints push que el servidor acepta. La suscripción la manda el cliente y
// después el servidor hace peticiones a esa URL: aceptar cualquiera permitiría
// usar el cron o la prueba para llamar a hosts internos (SSRF ciego).

// Servicios push de los navegadores que usan la app:
// - Chrome, Edge en Android, Samsung Internet, Opera y Brave: FCM;
// - Firefox (escritorio y Android): autopush de Mozilla;
// - Safari en macOS e iOS/iPadOS (16.4+, app instalada): Apple pide aceptar
//   cualquier subdominio de push.apple.com (hoy `web.push.apple.com`);
// - Edge en Windows: WNS, con un subdominio por región.
// El GCM antiguo (`android.googleapis.com`) ya no entrega y no se acepta.
const PUSH_SERVICE_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
]);
const PUSH_SERVICE_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

// Las URLs de WNS son las más largas (token en la query) y no llegan a 1 KB.
export const MAX_PUSH_ENDPOINT_LENGTH = 2048;

// Dispositivos por usuario. Al registrar uno nuevo por encima del límite se
// borran los que llevan más tiempo sin actualizarse.
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

// Solo `https://<host>` seguido de ruta o query, sin usuario, puerto, espacios,
// controles ni barras invertidas. web-push resuelve el host con el parser
// antiguo de Node (`url.parse`): con esta forma los dos parsers ven el mismo.
const ENDPOINT_PATTERN =
  /^https:\/\/([a-z0-9.-]+)(?:[/?][^\u0000- \u007F\\]*)?$/i;

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_PUSH_ENDPOINT_LENGTH) {
    return false;
  }

  const match = ENDPOINT_PATTERN.exec(value);
  if (!match) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const host = match[1].toLowerCase();
  if (url.hostname !== host || url.port !== "") return false;

  return (
    PUSH_SERVICE_HOSTS.has(host) ||
    PUSH_SERVICE_HOST_SUFFIXES.some(
      (suffix) => host.endsWith(suffix) && host.length > suffix.length,
    )
  );
}

type StoredPushSubscription = {
  endpoint: string;
  updated_at: string;
};

function byMostRecentlyUpdated(
  left: StoredPushSubscription,
  right: StoredPushSubscription,
) {
  return right.updated_at.localeCompare(left.updated_at);
}

// Suscripciones a las que el cron puede enviar, agrupadas por usuario: solo
// de hosts permitidos (las filas se pueden insertar sin pasar por la API) y,
// como mucho, las `limit` actualizadas más recientemente de cada uno.
export function groupDeliverablePushSubscriptions<
  T extends StoredPushSubscription & { user_id: string },
>(rows: T[], limit = MAX_PUSH_SUBSCRIPTIONS_PER_USER) {
  const byUser = new Map<string, T[]>();
  let blocked = 0;

  for (const row of rows) {
    if (!isAllowedPushEndpoint(row.endpoint)) {
      blocked += 1;
      continue;
    }
    const current = byUser.get(row.user_id);
    if (current) {
      current.push(row);
    } else {
      byUser.set(row.user_id, [row]);
    }
  }

  for (const [userId, subscriptions] of byUser) {
    byUser.set(userId, subscriptions.sort(byMostRecentlyUpdated).slice(0, limit));
  }

  return { byUser, blocked };
}

// Endpoints que hay que borrar para que, con el nuevo, el usuario no pase del
// límite: se conservan los actualizados más recientemente. Volver a guardar
// un endpoint que ya existe no cuenta como uno más.
export function pushEndpointsToEvict(
  stored: StoredPushSubscription[],
  incomingEndpoint: string,
  limit = MAX_PUSH_SUBSCRIPTIONS_PER_USER,
): string[] {
  const others = stored.filter(
    (subscription) => subscription.endpoint !== incomingEndpoint,
  );
  const keep = Math.max(limit - 1, 0);
  if (others.length <= keep) return [];

  return [...others]
    .sort(byMostRecentlyUpdated)
    .slice(keep)
    .map((subscription) => subscription.endpoint);
}
