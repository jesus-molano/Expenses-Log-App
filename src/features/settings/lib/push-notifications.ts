type PushSubscribeConfig = {
  publicKey: string;
};

export type PushSubscribeResult = {
  mode?: "demo";
  message?: string;
};

export type PushHealth = {
  mode: "ready" | "demo";
  registered: boolean;
  subscriptionUpdatedAt?: string | null;
  lastScheduledDeliveryAt?: string | null;
};

export type PushTestResult = {
  ok: true;
  sentAt: string;
};

export class PushApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "PushApiError";
  }
}

type PushApiPayload = {
  code?: string;
  error?: string;
  message?: string;
  mode?: "demo" | "ready";
  publicKey?: string;
  registered?: boolean;
  subscriptionUpdatedAt?: string | null;
  lastScheduledDeliveryAt?: string | null;
  ok?: boolean;
  sentAt?: string;
};

async function readPushResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as PushApiPayload;
  if (!response.ok) {
    throw new PushApiError(
      payload.code ?? payload.error ?? "PUSH_REQUEST_FAILED",
      response.status,
    );
  }
  return payload;
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export async function fetchPushSubscribeConfig(): Promise<PushSubscribeConfig> {
  const response = await fetch("/api/push/subscribe");
  const payload = await readPushResponse(response);

  if (!payload.publicKey) {
    throw new PushApiError("PUSH_NOT_CONFIGURED", response.status);
  }

  return { publicKey: payload.publicKey };
}

export async function createPushSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

// Sustituye la suscripción del navegador por otra nueva, con otro endpoint.
// Sirve cuando el endpoint actual quedó registrado a nombre de otra cuenta
// que cerró sesión sin borrarlo (antes de que el cierre de sesión lo hiciera).
export async function renewPushSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  const existing = await registration.pushManager.getSubscription();
  await existing?.unsubscribe();

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function savePushSubscription(
  subscription: PushSubscription,
): Promise<PushSubscribeResult> {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const payload = await readPushResponse(response);

  return {
    mode: payload.mode === "demo" ? "demo" : undefined,
    message: payload.message,
  };
}

export async function deletePushSubscription(
  subscription: PushSubscription,
  { signal }: { signal?: AbortSignal } = {},
): Promise<PushSubscribeResult> {
  const response = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    signal,
  });
  const payload = await readPushResponse(response);

  return {
    mode: payload.mode === "demo" ? "demo" : undefined,
    message: payload.message,
  };
}

export async function fetchPushHealth(
  subscription: PushSubscription,
): Promise<PushHealth> {
  const response = await fetch("/api/push/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  const payload = await readPushResponse(response);

  return {
    mode: payload.mode === "demo" ? "demo" : "ready",
    registered: Boolean(payload.registered),
    subscriptionUpdatedAt: payload.subscriptionUpdatedAt,
    lastScheduledDeliveryAt: payload.lastScheduledDeliveryAt,
  };
}

export async function sendPushTest(
  subscription: PushSubscription,
): Promise<PushTestResult> {
  const response = await fetch("/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  const payload = await readPushResponse(response);

  if (!payload.ok || !payload.sentAt) {
    throw new PushApiError("PUSH_TEST_INVALID_RESPONSE", response.status);
  }

  return { ok: true, sentAt: payload.sentAt };
}

export async function getCurrentPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;

  return registration.pushManager.getSubscription();
}

// Plazo del borrado remoto al cerrar sesión: sin red no debe bloquear la
// salida.
export const RELEASE_PUSH_TIMEOUT_MS = 4_000;

export type PushReleaseResult = "none" | "released" | "incomplete";

// Al cerrar sesión, los avisos de este navegador dejan de ser de esa cuenta.
// Primero se borra el registro remoto (necesita la sesión, por eso va antes
// del signOut) y después se anula la suscripción del navegador. Anularla
// invalida el endpoint aunque el borrado remoto falle: el cron poda esa fila
// cuando el servicio push responda 404/410. Nunca lanza.
export async function releasePushSubscription({
  timeoutMs = RELEASE_PUSH_TIMEOUT_MS,
}: { timeoutMs?: number } = {}): Promise<PushReleaseResult> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return "none";
  }

  const subscription = await getCurrentPushSubscription().catch(() => null);
  if (!subscription) return "none";

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let remoteFailed = false;
  try {
    await deletePushSubscription(subscription, { signal: controller.signal });
  } catch {
    remoteFailed = true;
  } finally {
    window.clearTimeout(timer);
  }

  const unsubscribed = await subscription.unsubscribe().catch(() => false);
  return remoteFailed || !unsubscribed ? "incomplete" : "released";
}
