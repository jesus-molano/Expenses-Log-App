import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_HEARTBEAT_KEY } from "@/data/persistence/push-heartbeat-store";
import { urlBase64ToUint8Array } from "@/pwa/push-subscription";
import { isHeartbeatDue, syncPushHeartbeat } from "./push-heartbeat";
import {
  createPushSubscription,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  savePushSubscription,
} from "./push-notifications";

vi.mock("./push-notifications", () => ({
  createPushSubscription: vi.fn(),
  fetchPushSubscribeConfig: vi.fn(),
  getCurrentPushSubscription: vi.fn(),
  savePushSubscription: vi.fn(),
}));

const publicKey = "SGVsbG8td29ybGQ";
const now = new Date("2026-10-23T10:00:00.000Z");

function subscription(endpoint: string, key: string) {
  return {
    endpoint,
    options: { applicationServerKey: urlBase64ToUint8Array(key).buffer },
  } as unknown as PushSubscription;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: {} }) },
  });
  vi.mocked(fetchPushSubscribeConfig).mockResolvedValue({ publicKey });
  vi.mocked(savePushSubscription).mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("isHeartbeatDue", () => {
  it("runs once a day, when the endpoint changes or the clock went back", () => {
    const last = { endpoint: "a", at: "2026-10-23T09:00:00.000Z" };
    expect(isHeartbeatDue(null, "a", now)).toBe(true);
    expect(isHeartbeatDue(last, "a", now)).toBe(false);
    expect(isHeartbeatDue(last, "b", now)).toBe(true);
    expect(isHeartbeatDue(last, "a", new Date("2026-10-24T09:00:00.000Z"))).toBe(true);
    expect(isHeartbeatDue(last, "a", new Date("2026-10-22T09:00:00.000Z"))).toBe(true);
  });
});

describe("syncPushHeartbeat", () => {
  it("does nothing without permission or subscription", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    await expect(syncPushHeartbeat(now)).resolves.toBe("skipped");

    vi.stubGlobal("Notification", { permission: "granted" });
    vi.mocked(getCurrentPushSubscription).mockResolvedValue(null);
    await expect(syncPushHeartbeat(now)).resolves.toBe("skipped");
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("confirms the current subscription once a day", async () => {
    const current = subscription("https://push.example.test/device", publicKey);
    vi.mocked(getCurrentPushSubscription).mockResolvedValue(current);

    await expect(syncPushHeartbeat(now)).resolves.toBe("confirmed");
    expect(savePushSubscription).toHaveBeenCalledWith(current);
    expect(JSON.parse(window.localStorage.getItem(PUSH_HEARTBEAT_KEY) ?? "{}")).toEqual({
      endpoint: current.endpoint,
      at: now.toISOString(),
    });

    await expect(syncPushHeartbeat(new Date("2026-10-23T18:00:00.000Z"))).resolves.toBe(
      "skipped",
    );
    expect(savePushSubscription).toHaveBeenCalledTimes(1);
  });

  it("renews a subscription made with an old server key", async () => {
    const stale = subscription("https://push.example.test/old", "T3RoZXIta2V5");
    const renewed = subscription("https://push.example.test/new", publicKey);
    vi.mocked(getCurrentPushSubscription).mockResolvedValue(stale);
    vi.mocked(createPushSubscription).mockResolvedValue(renewed);

    await expect(syncPushHeartbeat(now)).resolves.toBe("renewed");
    expect(savePushSubscription).toHaveBeenCalledWith(renewed, {
      previousEndpoint: "https://push.example.test/old",
    });
  });
});
