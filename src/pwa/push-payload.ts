// Contrato del mensaje push entre el servidor (cron y prueba) y el service
// worker, más las reglas puras que aplica el service worker al recibirlo.

export type PushNotificationPayload = {
  title: string;
  body: string;
  // Ruta de la app que abre la notificación (mismo origen).
  url: string;
  // Notificaciones con la misma etiqueta se sustituyen en lugar de apilarse.
  tag?: string;
  // Número para el icono de la app (vencidos y de hoy).
  badgeCount?: number;
  lang?: string;
};

const FALLBACK_TITLE = "Expense Reminders";
const FALLBACK_BODY = "Tienes gastos por revisar.";
const MAX_TEXT_LENGTH = 240;

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, MAX_TEXT_LENGTH)
    : fallback;
}

// Un payload ilegible o incompleto sigue mostrando una notificación: el
// navegador penaliza los push que no la muestran.
export function parsePushPayload(data: unknown): PushNotificationPayload {
  const value =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const badgeCount = Number(value.badgeCount);

  return {
    title: text(value.title, FALLBACK_TITLE),
    body: text(value.body, FALLBACK_BODY),
    url: typeof value.url === "string" ? value.url : "/",
    ...(typeof value.tag === "string" && value.tag ? { tag: value.tag.slice(0, 120) } : {}),
    ...(value.badgeCount !== undefined &&
    Number.isInteger(badgeCount) &&
    badgeCount >= 0
      ? { badgeCount }
      : {}),
    ...(value.lang === "es" || value.lang === "en" ? { lang: value.lang } : {}),
  };
}

// Solo rutas del mismo origen: una URL externa en el payload abre la app.
export function resolveNotificationUrl(requested: unknown, origin: string): string {
  try {
    const url = new URL(String(requested ?? "/"), origin);
    return url.origin === origin ? url.href : new URL("/", origin).href;
  } catch {
    return new URL("/", origin).href;
  }
}
