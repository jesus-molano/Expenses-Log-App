type PushSubscribeConfig = {
  publicKey: string;
};

export type PushSubscribeResult = {
  mode?: "demo";
  message?: string;
};

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
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    publicKey?: string;
  };

  if (!response.ok || !payload.publicKey) {
    throw new Error(payload.error ?? "Push notifications are not configured.");
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
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    mode?: "demo";
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not save push subscription.");
  }

  return {
    mode: payload.mode,
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
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    mode?: "demo";
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not delete push subscription.");
  }

  return {
    mode: payload.mode,
    message: payload.message,
  };
}

export async function getCurrentPushSubscription() {
  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.ready);

  return registration.pushManager.getSubscription();
}
