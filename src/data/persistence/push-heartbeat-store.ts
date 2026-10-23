// Último latido de la suscripción push de este dispositivo: qué endpoint se
// confirmó al servidor y cuándo. No se sincroniza.
export type PushHeartbeat = {
  endpoint: string;
  at: string;
};

export const PUSH_HEARTBEAT_KEY = "push-heartbeat-v1";

export function parsePushHeartbeat(raw: string | null): PushHeartbeat | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PushHeartbeat>;
    return typeof value.endpoint === "string" &&
      typeof value.at === "string" &&
      !Number.isNaN(Date.parse(value.at))
      ? { endpoint: value.endpoint, at: value.at }
      : null;
  } catch {
    return null;
  }
}

export function readPushHeartbeat(): PushHeartbeat | null {
  try {
    return parsePushHeartbeat(window.localStorage.getItem(PUSH_HEARTBEAT_KEY));
  } catch {
    return null;
  }
}

export function writePushHeartbeat(heartbeat: PushHeartbeat) {
  try {
    window.localStorage.setItem(PUSH_HEARTBEAT_KEY, JSON.stringify(heartbeat));
  } catch {
    // Sin localStorage el latido se repite en la próxima visita.
  }
}
