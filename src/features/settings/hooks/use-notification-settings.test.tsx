import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPushSubscription,
  fetchPushHealth,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  savePushSubscription,
} from "../lib/push-notifications";
import { useNotificationSettings } from "./use-notification-settings";

vi.mock("../lib/push-notifications", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../lib/push-notifications")
  >();
  return {
    ...actual,
    createPushSubscription: vi.fn(),
    deletePushSubscription: vi.fn(),
    fetchPushHealth: vi.fn(),
    fetchPushSubscribeConfig: vi.fn(),
    getCurrentPushSubscription: vi.fn(),
    savePushSubscription: vi.fn(),
    sendPushTest: vi.fn(),
  };
});

const subscription = {
  endpoint: "https://push.example.test/device",
} as PushSubscription;

beforeEach(() => {
  vi.stubGlobal("PushManager", class PushManager {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: vi.fn().mockResolvedValue({ pushManager: {} }) },
  });
  vi.mocked(getCurrentPushSubscription).mockResolvedValue(null);
  vi.mocked(fetchPushSubscribeConfig).mockResolvedValue({ publicKey: "public" });
  vi.mocked(createPushSubscription).mockResolvedValue(subscription);
  vi.mocked(savePushSubscription).mockResolvedValue({});
  vi.mocked(fetchPushHealth).mockResolvedValue({
    mode: "ready",
    registered: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("useNotificationSettings", () => {
  it("asks for permission in the user action before fetching configuration", async () => {
    const order: string[] = [];
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(() => {
        order.push("permission");
        return Promise.resolve("granted");
      }),
    });
    vi.mocked(fetchPushSubscribeConfig).mockImplementation(async () => {
      order.push("config");
      return { publicKey: "public" };
    });
    const setMessage = vi.fn();
    const { result } = renderHook(() => useNotificationSettings(setMessage));

    await act(async () => {
      await result.current.enableNotifications();
    });

    expect(order).toEqual(["permission", "config"]);
    expect(result.current.notificationState).toBe("ready");
    expect(savePushSubscription).toHaveBeenCalledWith(subscription);
    expect(fetchPushHealth).toHaveBeenCalledWith(subscription);
  });

  it("silently repairs an existing granted subscription on mount", async () => {
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });
    vi.mocked(getCurrentPushSubscription).mockResolvedValue(subscription);
    const setMessage = vi.fn();
    const { result } = renderHook(() => useNotificationSettings(setMessage));

    await waitFor(() => expect(result.current.notificationState).toBe("ready"));

    expect(savePushSubscription).toHaveBeenCalledWith(subscription);
    expect(fetchPushHealth).toHaveBeenCalledWith(subscription);
    expect(setMessage).not.toHaveBeenCalled();
  });
});
