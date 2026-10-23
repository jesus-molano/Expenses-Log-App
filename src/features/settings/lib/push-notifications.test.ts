import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPushHealth,
  PushApiError,
  releasePushSubscription,
  renewPushSubscription,
  sendPushTest,
  urlBase64ToUint8Array,
} from "./push-notifications";

const subscription = {
  endpoint: "https://push.example.test/device",
} as PushSubscription;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function browserSubscription(endpoint = "https://fcm.googleapis.com/fcm/send/device") {
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
}

function stubRegistration(current: PushSubscription | null) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(current),
    subscribe: vi.fn(),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ pushManager }) },
  });
  return pushManager;
}

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 values", () => {
    const atobSpy = vi
      .spyOn(window, "atob")
      .mockImplementation((value) => Buffer.from(value, "base64").toString("binary"));

    const output = urlBase64ToUint8Array("SGVsbG8td29ybGQ");

    expect(Array.from(output)).toEqual(
      Array.from("Hello-world", (character) => character.charCodeAt(0)),
    );
    atobSpy.mockRestore();
  });
});

describe("push API client", () => {
  it("reads registration health for the current endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "ready",
          registered: true,
          subscriptionUpdatedAt: "2026-08-23T10:00:00.000Z",
          lastScheduledDeliveryAt: "2026-08-23T08:00:00.000Z",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPushHealth(subscription)).resolves.toMatchObject({
      mode: "ready",
      registered: true,
      lastScheduledDeliveryAt: "2026-08-23T08:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }),
    );
  });

  it("sends only the endpoint when requesting a test", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, sentAt: "2026-08-23T11:00:00.000Z" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPushTest(subscription)).resolves.toEqual({
      ok: true,
      sentAt: "2026-08-23T11:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/test",
      expect.objectContaining({
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }),
    );
  });

  it("keeps the stable server error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "PUSH_SUBSCRIPTION_EXPIRED" }), {
          status: 409,
        }),
      ),
    );

    await expect(sendPushTest(subscription)).rejects.toEqual(
      expect.objectContaining<Partial<PushApiError>>({
        code: "PUSH_SUBSCRIPTION_EXPIRED",
        status: 409,
      }),
    );
  });
});

describe("releasePushSubscription", () => {
  it("does nothing without a browser subscription", async () => {
    stubRegistration(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(releasePushSubscription()).resolves.toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the remote registration before unsubscribing the browser", async () => {
    const order: string[] = [];
    const subscription = browserSubscription();
    subscription.unsubscribe.mockImplementation(async () => {
      order.push("unsubscribe");
      return true;
    });
    stubRegistration(subscription);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        order.push("delete");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await expect(releasePushSubscription()).resolves.toBe("released");
    expect(order).toEqual(["delete", "unsubscribe"]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }),
    );
  });

  it("still unsubscribes the browser when the remote delete fails", async () => {
    const subscription = browserSubscription();
    stubRegistration(subscription);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(releasePushSubscription()).resolves.toBe("incomplete");
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("does not wait for a server that never answers", async () => {
    vi.useFakeTimers();
    const subscription = browserSubscription();
    stubRegistration(subscription);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const released = releasePushSubscription({ timeoutMs: 4000 });
    await vi.advanceTimersByTimeAsync(4000);

    await expect(released).resolves.toBe("incomplete");
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});

describe("renewPushSubscription", () => {
  it("replaces the browser subscription with a new endpoint", async () => {
    const atobSpy = vi
      .spyOn(window, "atob")
      .mockImplementation((value) => Buffer.from(value, "base64").toString("binary"));
    const current = browserSubscription();
    const fresh = browserSubscription("https://fcm.googleapis.com/fcm/send/fresh");
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(current),
      subscribe: vi.fn().mockResolvedValue(fresh),
    };

    await expect(
      renewPushSubscription(
        { pushManager } as unknown as ServiceWorkerRegistration,
        "SGVsbG8",
      ),
    ).resolves.toBe(fresh);
    expect(current.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    atobSpy.mockRestore();
  });
});
