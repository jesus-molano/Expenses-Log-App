import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPushSubscription,
  fetchPushHealth,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  PushApiError,
  renewPushSubscription,
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
    renewPushSubscription: vi.fn(),
    savePushSubscription: vi.fn(),
    sendPushTest: vi.fn(),
  };
});

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device",
} as PushSubscription;
const freshSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/fresh",
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

  it("takes over an endpoint left registered by another account when enabling", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    vi.mocked(savePushSubscription)
      .mockRejectedValueOnce(new PushApiError("PUSH_SUBSCRIPTION_IN_USE", 409))
      .mockResolvedValue({});
    vi.mocked(renewPushSubscription).mockResolvedValue(freshSubscription);
    const setMessage = vi.fn();
    const { result } = renderHook(() => useNotificationSettings(setMessage));
    // Deja pasar la comprobación inicial (setTimeout 0) antes de activar.
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 0)));

    await act(async () => {
      await result.current.enableNotifications();
    });

    expect(renewPushSubscription).toHaveBeenCalledTimes(1);
    expect(savePushSubscription).toHaveBeenLastCalledWith(freshSubscription);
    expect(fetchPushHealth).toHaveBeenCalledWith(freshSubscription);
    expect(result.current.notificationState).toBe("ready");
  });

  it("does not renew in the background and explains how to fix it", async () => {
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });
    vi.mocked(getCurrentPushSubscription).mockResolvedValue(subscription);
    vi.mocked(savePushSubscription).mockRejectedValue(
      new PushApiError("PUSH_SUBSCRIPTION_IN_USE", 409),
    );
    const setMessage = vi.fn();
    const { result } = renderHook(() => useNotificationSettings(setMessage));

    await waitFor(() => expect(result.current.notificationState).toBe("error"));
    expect(renewPushSubscription).not.toHaveBeenCalled();
    expect(setMessage).not.toHaveBeenCalled();
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
