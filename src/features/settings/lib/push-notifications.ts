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
): Promise<PushSubscribeResult> {
  const response = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
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
