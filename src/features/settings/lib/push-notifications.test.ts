import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPushSubscription,
  fetchPushHealth,
  PushApiError,
  savePushSubscription,
  sendPushTest,
  urlBase64ToUint8Array,
} from "./push-notifications";

const subscription = {
  endpoint: "https://push.example.test/device",
} as PushSubscription;

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("push subscription lifecycle", () => {
  const publicKey = "SGVsbG8td29ybGQ";

  function registration(existing: Partial<PushSubscription> | null) {
    const subscribe = vi.fn().mockResolvedValue({ endpoint: "https://push.example.test/new" });
    return {
      subscribe,
      value: {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(existing),
          subscribe,
        },
      } as unknown as ServiceWorkerRegistration,
    };
  }

  it("reuses a subscription created with the current key", async () => {
    const existing = {
      endpoint: "https://push.example.test/device",
      options: { applicationServerKey: urlBase64ToUint8Array(publicKey).buffer },
    } as unknown as PushSubscription;
    const { value, subscribe } = registration(existing);

    await expect(createPushSubscription(value, publicKey)).resolves.toBe(existing);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("replaces a subscription created with an old VAPID key", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const existing = {
      endpoint: "https://push.example.test/old",
      options: { applicationServerKey: urlBase64ToUint8Array("T3RoZXIta2V5").buffer },
      unsubscribe,
    } as unknown as PushSubscription;
    const { value, subscribe } = registration(existing);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPushSubscription(value, publicKey)).resolves.toEqual({
      endpoint: "https://push.example.test/new",
    });
    expect(unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("tells the server which endpoint a renewal replaces", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const renewed = {
      endpoint: "https://push.example.test/new",
      toJSON: () => ({ endpoint: "https://push.example.test/new", keys: { p256dh: "p", auth: "a" } }),
    } as unknown as PushSubscription;

    await savePushSubscription(renewed, { previousEndpoint: "https://push.example.test/old" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      endpoint: "https://push.example.test/new",
      keys: { p256dh: "p", auth: "a" },
      previousEndpoint: "https://push.example.test/old",
    });
  });
});
