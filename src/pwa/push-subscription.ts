// Reglas puras de la suscripción push, comunes a la app y al service worker.

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = globalThis.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

// Si la suscripción se creó con la clave VAPID actual. Al cambiar la clave del
// servidor, una suscripción antigua sigue existiendo pero el servicio push
// rechaza los envíos (403): hay que crear otra. Sin clave legible no se puede
// saber y se da por buena.
export function applicationServerKeyMatches(
  key: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!key) return true;
  let expected: Uint8Array;
  try {
    expected = urlBase64ToUint8Array(publicKey);
  } catch {
    return true;
  }
  const actual = new Uint8Array(key);
  return (
    actual.length === expected.length &&
    actual.every((byte, index) => byte === expected[index])
  );
}

export type PushSubscriptionRenewal = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  // Endpoint que sustituye, para borrarlo en el servidor.
  previousEndpoint?: string;
};

export function buildSubscriptionRenewal(
  subscription: Pick<PushSubscriptionJSON, "endpoint" | "keys">,
  previousEndpoint?: string | null,
): PushSubscriptionRenewal | null {
  if (!subscription.endpoint) return null;
  return {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    ...(previousEndpoint && previousEndpoint !== subscription.endpoint
      ? { previousEndpoint }
      : {}),
  };
}
